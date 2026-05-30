from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.config.db import db
from app.middleware.auth_middleware import get_current_user
from jose import jwt, JWTError
import asyncio
import os
from pydantic import BaseModel, field_validator
from typing import Literal

class JoinRequest(BaseModel):
    gender_filter: Literal["male", "female", ""] = ""

router = APIRouter()

waiting_pool = db.waiting_pool
sessions_collection = db.sessions
users_collection = db.users


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_details(user: dict) -> dict:
    return {
        "name": user.get("name", ""),
        "interested_in": user.get("interested_in", ""),
        "tagline": user.get("tagline", ""),
        "gender": user.get("gender", ""),
        "honour": user.get("honour", 50),
    }


def _end_session(session: dict, disconnected_by: str, reason: str) -> int:
    now = datetime.now(timezone.utc)
    started_at = session.get("started_at")

    if started_at and started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)

    duration = int((now - started_at).total_seconds()) if started_at else 0

    sessions_collection.update_one(
        {"_id": session["_id"]},
        {
            "$set": {
                "status": "ended",
                "ended_at": now,
                "duration_seconds": duration,
                "disconnected_by": disconnected_by,
                "disconnect_reason": reason,
            }
        },
    )
    return duration


# ---------------------------------------------------------------------------
# Connection Manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        self.active_connections.pop(user_id, None)

    def is_connected(self, user_id: str) -> bool:
        return user_id in self.active_connections

    async def send_message(self, user_id: str, message: dict):
        ws = self.active_connections.get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(user_id)

    async def wait_and_send(self, user_id: str, message: dict, timeout: int = 5) -> bool:
        for _ in range(timeout * 10):
            if self.is_connected(user_id):
                await self.send_message(user_id, message)
                return True
            await asyncio.sleep(0.1)

        # Timeout — joining user connect nahi hua
        session_id = message.get("session_id")
        partner_id = message.get("partner_id")

        if session_id and partner_id:
            session = sessions_collection.find_one({"_id": ObjectId(session_id)})
            if session:
                _end_session(session, disconnected_by=user_id, reason="ws_timeout")

            await self.send_message(partner_id, {
                "status": "partner_disconnected",
                "reason": "ws_timeout",
            })

        return False

manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/instant-connect/join")
async def join_queue(
    request_data: JoinRequest,
    current_user: dict = Depends(get_current_user),
):
    gender_filter = request_data.gender_filter

    existing = waiting_pool.find_one({"user_id": current_user["user_id"]})
    if existing:
        return {"status": "waiting", "message": "Already in queue"}

    query = {"user_id": {"$ne": current_user["user_id"]}}

    # Joining user ka filter — partner ki gender sahi honi chahiye
    if gender_filter:
        query["gender"] = gender_filter

    # Waiting user ka filter bhi check karo
    # Ya toh unka koi filter nahi, ya unka filter joining user ki gender se match kare
    query["$or"] = [
        {"gender_filter": ""},
        {"gender_filter": current_user.get("gender", "")}
    ]

    partner = waiting_pool.find_one_and_delete(query)

    if partner:
        now = datetime.now(timezone.utc)

        session = sessions_collection.insert_one({
            "user_1": partner["user_id"],
            "user_2": current_user["user_id"],
            "status": "active",
            "started_at": now,
            "ended_at": None,
            "duration_seconds": None,
            "disconnected_by": None,
            "disconnect_reason": None,
            "ratings": {
                "user_1_rating": None,
                "user_2_rating": None,
            },
            "rated_by": [],
        })

        session_id = str(session.inserted_id)

        partner_user = users_collection.find_one({"_id": ObjectId(partner["user_id"])})
        if not partner_user:
            return {"status": "error", "message": "Partner user not found"}

        current_user_details = _user_details(current_user)
        partner_details = _user_details(partner_user)

        await manager.send_message(partner["user_id"], {
            "status": "matched",
            "session_id": session_id,
            "partner": current_user_details,
            "is_caller": True,
            "partner_id": current_user["user_id"],
        })

        joining_user_message = {
            "status": "matched",
            "session_id": session_id,
            "partner": partner_details,
            "is_caller": False,
            "partner_id": partner["user_id"],
        }

        if manager.is_connected(current_user["user_id"]):
            await manager.send_message(current_user["user_id"], joining_user_message)
        else:
            asyncio.create_task(
                manager.wait_and_send(current_user["user_id"], joining_user_message)
            )

        return {"status": "matched", "session_id": session_id}

    waiting_pool.insert_one({
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "gender": current_user.get("gender", ""),
        "gender_filter": gender_filter,
        "status": "waiting",
        "joined_at": datetime.now(timezone.utc),
    })

    return {"status": "waiting", "message": "Added to waiting pool"}


@router.post("/instant-connect/cancel")
async def cancel_queue(
    current_user: dict = Depends(get_current_user),
):
    session = sessions_collection.find_one({
        "$or": [
            {"user_1": current_user["user_id"]},
            {"user_2": current_user["user_id"]},
        ],
        "status": "active",
    })

    if session:
        _end_session(
            session,
            disconnected_by=current_user["user_id"],
            reason="manual",
        )

        partner_id = (
            session["user_2"]
            if session["user_1"] == current_user["user_id"]
            else session["user_1"]
        )

        await manager.send_message(partner_id, {
            "status": "partner_disconnected",
            "reason": "manual",
        })

    waiting_pool.delete_one({"user_id": current_user["user_id"]})

    return {"message": "Removed from queue"}


@router.get("/instant-connect/status")
async def get_status(
    current_user: dict = Depends(get_current_user),
):
    session = sessions_collection.find_one({
        "$or": [
            {"user_1": current_user["user_id"]},
            {"user_2": current_user["user_id"]},
        ],
        "status": "active",
    })

    if not session:
        in_queue = waiting_pool.find_one({"user_id": current_user["user_id"]})
        return {"status": "waiting" if in_queue else "idle"}

    partner_id = (
        session["user_2"]
        if session["user_1"] == current_user["user_id"]
        else session["user_1"]
    )

    return {
        "status": "matched",
        "partner_id": partner_id,
        "session_id": str(session["_id"]),
    }


@router.post("/instant-connect/rate")
async def rate_partner(
    rating_data: dict,
    current_user: dict = Depends(get_current_user),
):
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

    session = sessions_collection.find_one({"_id": session_obj_id})

    if not session:
        return {"message": "Session not found"}

    if session.get("status") != "ended":
        return {"message": "Cannot rate an active session"}

    uid = current_user["user_id"]

    if uid not in [session["user_1"], session["user_2"]]:
        return {"message": "Unauthorized — you were not part of this session"}

    if uid in session.get("rated_by", []):
        return {"message": "Already rated this session"}

    is_user1 = session["user_1"] == uid
    partner_id = session["user_2"] if is_user1 else session["user_1"]
    rating_field = "ratings.user_1_rating" if is_user1 else "ratings.user_2_rating"

    # Bug fix 1 — self rating check
    if partner_id == uid:
        return {"message": "Unauthorized — you cannot rate yourself"}

    # Bug fix 2 — atomic honour update, no race condition
    users_collection.update_one(
        {"_id": ObjectId(partner_id)},
        [
            {"$set": {"honour": {
                "$max": [0, {"$min": [200, {"$add": ["$honour", rating]}]}]
            }}}
        ]
    )

    sessions_collection.update_one(
        {"_id": session_obj_id},
        {
            "$set": {rating_field: rating},
            "$push": {"rated_by": uid},
        },
    )

    return {"message": "Rating submitted successfully"}


# ---------------------------------------------------------------------------
# WebSocket — WebRTC signaling + disconnect handling
# ---------------------------------------------------------------------------

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, token: str = Query(...)):
    try:
        payload = jwt.decode(token, os.getenv("JWT_SECRET"), algorithms=["HS256"])
        if payload.get("user_id") != user_id:
            await websocket.close(code=4001)
            return
    except JWTError:
        await websocket.close(code=4001)
        return

    await manager.connect(user_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") in ["offer", "answer", "ice-candidate"]:
                target_id = data.get("target_id")
                data["sender_id"] = user_id
                await manager.send_message(target_id, data)

    except WebSocketDisconnect:
        manager.disconnect(user_id)

        session = sessions_collection.find_one({
            "$or": [
                {"user_1": user_id},
                {"user_2": user_id},
            ],
            "status": "active",
        })

        if session:
            _end_session(
                session,
                disconnected_by=user_id,
                reason="ws_drop",
            )

            partner_id = (
                session["user_2"]
                if session["user_1"] == user_id
                else session["user_1"]
            )

            await manager.send_message(partner_id, {
                "status": "partner_disconnected",
                "reason": "ws_drop",
            })

        waiting_pool.delete_one({"user_id": user_id})