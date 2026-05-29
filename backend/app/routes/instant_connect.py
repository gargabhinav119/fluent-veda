from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from datetime import datetime, timezone
from app.config.db import db
from app.middleware.auth_middleware import get_current_user
import asyncio

router = APIRouter()

waiting_pool = db.waiting_pool
sessions_collection = db.sessions
users_collection = db.users


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        self.active_connections.pop(user_id, None)

    def is_connected(self, user_id: str) -> bool:
        return user_id in self.active_connections

    async def send_message(self, user_id: str, message: dict):
        websocket = self.active_connections.get(user_id)
        if websocket:
            await websocket.send_json(message)

    async def wait_and_send(self, user_id: str, message: dict, timeout: int = 5):
        """WS connect hone ka wait karo, phir message bhejo"""
        for _ in range(timeout * 10):  # har 100ms check karo
            if self.is_connected(user_id):
                await self.send_message(user_id, message)
                return True
            await asyncio.sleep(0.1)
        return False  # timeout


manager = ConnectionManager()


@router.post("/instant-connect/join")
async def join_queue(
    current_user: dict = Depends(get_current_user)
):
    existing = waiting_pool.find_one({
        "user_id": current_user["user_id"]
    })

    if existing:
        return {
            "status": "waiting",
            "message": "Already in queue"
        }

    partner = waiting_pool.find_one_and_delete({
        "user_id": {"$ne": current_user["user_id"]}
    })

    if partner:
        session = sessions_collection.insert_one({
            "user_1": partner["user_id"],
            "user_2": current_user["user_id"],
            "status": "active",
            "started_at": datetime.now(timezone.utc)
        })

        partner_user = users_collection.find_one({
            "email": partner["email"]
        })

        session_id = str(session.inserted_id)

        current_user_details = {
            "name": current_user.get("name", ""),
            "email": current_user.get("email", ""),
            "phone": current_user.get("phone", ""),
            "interested_in": current_user.get("interested_in", ""),
            "tagline": current_user.get("tagline", "")
        }

        partner_details = {
            "name": partner_user.get("name", ""),
            "email": partner_user.get("email", ""),
            "phone": partner_user.get("phone", ""),
            "interested_in": partner_user.get("interested_in", ""),
            "tagline": partner_user.get("tagline", "")
        }

        # Waiting user (partner) — caller hoga, abhi connected hai
        await manager.send_message(partner["user_id"], {
            "status": "matched",
            "session_id": session_id,
            "partner": current_user_details,
            "is_caller": True,
            "partner_id": current_user["user_id"]
        })

        # Joining user — receiver hoga
        # WS abhi connected nahi ho sakta, isliye background mein wait karke bhejo
        joining_user_message = {
            "status": "matched",
            "session_id": session_id,
            "partner": partner_details,
            "is_caller": False,
            "partner_id": partner["user_id"]
        }

        if manager.is_connected(current_user["user_id"]):
            # WS already connected hai — seedha bhejo
            await manager.send_message(current_user["user_id"], joining_user_message)
        else:
            # WS abhi connect nahi — background task mein wait karke bhejo
            asyncio.create_task(
                manager.wait_and_send(current_user["user_id"], joining_user_message)
            )

        return {
            "status": "matched",
            "session_id": session_id,
        }

    waiting_pool.insert_one({
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "status": "waiting",
        "joined_at": datetime.now(timezone.utc)
    })

    return {
        "status": "waiting",
        "message": "Added to waiting pool"
    }


@router.post("/instant-connect/cancel")
async def cancel_queue(
    current_user: dict = Depends(get_current_user)
):
    session = sessions_collection.find_one({
        "$or": [
            {"user_1": current_user["user_id"]},
            {"user_2": current_user["user_id"]}
        ],
        "status": "active"
    })

    if session:
        sessions_collection.update_one(
            {"_id": session["_id"]},
            {"$set": {"status": "ended"}}
        )

        partner_id = (
            session["user_2"]
            if session["user_1"] == current_user["user_id"]
            else session["user_1"]
        )

        await manager.send_message(partner_id, {
            "status": "partner_disconnected"
        })

    waiting_pool.delete_one({
        "user_id": current_user["user_id"]
    })

    return {"message": "Removed from queue"}


@router.get("/instant-connect/status")
async def get_status(
    current_user: dict = Depends(get_current_user)
):
    session = sessions_collection.find_one({
        "$or": [
            {"user_1": current_user["user_id"]},
            {"user_2": current_user["user_id"]}
        ],
        "status": "active"
    })

    if not session:
        in_queue = waiting_pool.find_one({
            "user_id": current_user["user_id"]
        })
        return {"status": "waiting" if in_queue else "idle"}

    partner_id = (
        session["user_2"]
        if session["user_1"] == current_user["user_id"]
        else session["user_1"]
    )

    return {
        "status": "matched",
        "partner_id": partner_id,
        "session_id": str(session["_id"])
    }


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()

            if data["type"] in ["offer", "answer", "ice-candidate"]:
                target_id = data.get("target_id")
                data["sender_id"] = user_id
                await manager.send_message(target_id, data)

    except WebSocketDisconnect:
        manager.disconnect(user_id)

        # ✅ Yahan add karo — session dhundo aur partner ko notify karo
        session = sessions_collection.find_one({
            "$or": [
                {"user_1": user_id},
                {"user_2": user_id}
            ],
            "status": "active"
        })

        if session:
            sessions_collection.update_one(
                {"_id": session["_id"]},
                {"$set": {"status": "ended"}}
            )

            partner_id = (
                session["user_2"]
                if session["user_1"] == user_id
                else session["user_1"]
            )

            await manager.send_message(partner_id, {
                "status": "partner_disconnected"
            })

        # Queue se bhi hatao agar waiting mein tha
        waiting_pool.delete_one({"user_id": user_id})