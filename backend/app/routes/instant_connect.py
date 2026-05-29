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
        for _ in range(timeout * 10):
            if self.is_connected(user_id):
                await self.send_message(user_id, message)
                return True
            await asyncio.sleep(0.1)
        return False


manager = ConnectionManager()


@router.post("/instant-connect/join")
async def join_queue(
    request_data: dict = {},
    current_user: dict = Depends(get_current_user)
):
    gender_filter = request_data.get("gender_filter", "")

    existing = waiting_pool.find_one({
        "user_id": current_user["user_id"]
    })

    if existing:
        return {
            "status": "waiting",
            "message": "Already in queue"
        }

    # Gender filter ke saath partner dhundo
    query = {"user_id": {"$ne": current_user["user_id"]}}

    if gender_filter:
        query["gender"] = gender_filter

    partner = waiting_pool.find_one_and_delete(query)

    # Agar gender filter tha aur koi nahi mila
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
            "tagline": current_user.get("tagline", ""),
            "gender": current_user.get("gender", ""),
            "honour": current_user.get("honour", 50)
        }

        partner_details = {
            "name": partner_user.get("name", ""),
            "email": partner_user.get("email", ""),
            "phone": partner_user.get("phone", ""),
            "interested_in": partner_user.get("interested_in", ""),
            "tagline": partner_user.get("tagline", ""),
            "gender": partner_user.get("gender", ""),
            "honour": partner_user.get("honour", 50)
        }

        # Waiting user (partner) — caller hoga
        await manager.send_message(partner["user_id"], {
            "status": "matched",
            "session_id": session_id,
            "partner": current_user_details,
            "is_caller": True,
            "partner_id": current_user["user_id"]
        })

        joining_user_message = {
            "status": "matched",
            "session_id": session_id,
            "partner": partner_details,
            "is_caller": False,
            "partner_id": partner["user_id"]
        }

        if manager.is_connected(current_user["user_id"]):
            await manager.send_message(current_user["user_id"], joining_user_message)
        else:
            asyncio.create_task(
                manager.wait_and_send(current_user["user_id"], joining_user_message)
            )

        return {
            "status": "matched",
            "session_id": session_id,
        }

    # Koi partner nahi mila — queue mein daal do
    waiting_pool.insert_one({
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "gender": current_user.get("gender", ""),
        "gender_filter": gender_filter,
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


@router.post("/instant-connect/rate")
async def rate_partner(
    rating_data: dict,
    current_user: dict = Depends(get_current_user)
):
    from bson import ObjectId

    session_id = rating_data.get("session_id")
    rating = rating_data.get("rating")

    if not session_id or rating is None:
        return {"message": "session_id and rating are required"}

    if rating not in [-2, -1, 0, 1, 2]:
        return {"message": "Invalid rating value"}

    try:
        session_obj_id = ObjectId(session_id)
    except Exception:
        return {"message": "Invalid session_id"}

    session = sessions_collection.find_one({
        "_id": session_obj_id
    })

    if not session:
        return {"message": "Session not found"}

    if session.get("status") != "ended":
        return {"message": "Cannot rate an active session"}

    if current_user["user_id"] not in [session["user_1"], session["user_2"]]:
        return {"message": "Unauthorized — you were not part of this session"}

    if session["user_1"] == current_user["user_id"]:
        partner_id = session["user_2"]
    else:
        partner_id = session["user_1"]

    if partner_id == current_user["user_id"]:
        return {"message": "Cannot rate yourself"}

    rated_by = session.get("rated_by", [])
    if current_user["user_id"] in rated_by:
        return {"message": "Already rated this session"}

    partner = users_collection.find_one({
        "_id": ObjectId(partner_id)
    })

    if not partner:
        return {"message": "Partner not found"}

    current_honour = partner.get("honour", 50)
    new_honour = current_honour + rating

    if new_honour < 0:
        new_honour = 0

    if new_honour > 200:
        new_honour = 200

    users_collection.update_one(
        {"_id": ObjectId(partner_id)},
        {"$set": {"honour": new_honour}}
    )

    sessions_collection.update_one(
        {"_id": ObjectId(session_id)},
        {"$push": {"rated_by": current_user["user_id"]}}
    )

    return {"message": "Rating submitted successfully"}


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

        waiting_pool.delete_one({"user_id": user_id})