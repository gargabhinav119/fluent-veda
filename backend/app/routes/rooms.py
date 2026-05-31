from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from datetime import datetime, timezone
from bson import ObjectId
import time
import os
from agora_token_builder import RtcTokenBuilder
from app.config.db import db
from app.middleware.auth_middleware import get_current_user
from pydantic import BaseModel
from jose import jwt, JWTError

router = APIRouter()

rooms_collection = db.rooms
participants_collection = db.room_participants
messages_collection = db.room_messages
hand_raises_collection = db.room_hand_raises


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreateRoomRequest(BaseModel):
    name: str
    description: str = ""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_active_room_participant(room_id: str, user_id: str):
    return participants_collection.find_one({
        "room_id": room_id,
        "user_id": user_id,
        "left_at": None
    })

def _get_room(room_id: str):
    try:
        return rooms_collection.find_one({
            "_id": ObjectId(room_id),
            "status": "active"
        })
    except Exception:
        return None

def _verify_room_token(token: str):
    try:
        payload = jwt.decode(token, os.getenv("JWT_SECRET"), algorithms=["HS256"])
        return payload.get("user_id")
    except JWTError:
        return None

def _get_user_honour(user_id: str) -> int:
    try:
        user = db.users.find_one({"_id": ObjectId(user_id)})
        return user.get("honour", 0) if user else 0
    except Exception:
        return 0

def _cleanup_room(room_id: str):
    db.room_chat_banned.delete_many({"room_id": room_id})
    db.room_hand_raises.delete_many({"room_id": room_id, "status": "pending"})

def _cleanup_user_from_room(room_id: str, user_id: str):
    db.room_hand_raises.delete_many({
        "room_id": room_id,
        "user_id": user_id,
        "status": "pending"
    })
    db.room_chat_banned.delete_one({
        "room_id": room_id,
        "user_id": user_id,
    })


# ---------------------------------------------------------------------------
# Room Connection Manager
# ---------------------------------------------------------------------------

class RoomConnectionManager:
    def __init__(self):
        self.rooms: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, room_id: str, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
        self.rooms[room_id][user_id] = websocket

    def disconnect(self, room_id: str, user_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].pop(user_id, None)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def broadcast(self, room_id: str, message: dict, exclude_user_id: str = None):
        if room_id not in self.rooms:
            return
        for uid, ws in list(self.rooms[room_id].items()):
            if uid == exclude_user_id:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(room_id, uid)

    async def send(self, room_id: str, user_id: str, message: dict):
        ws = self.rooms.get(room_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(room_id, user_id)


room_manager = RoomConnectionManager()


# ---------------------------------------------------------------------------
# REST Routes
# ---------------------------------------------------------------------------

@router.post("/rooms/create")
def create_room(
    data: CreateRoomRequest,
    current_user: dict = Depends(get_current_user)
):
    honour = _get_user_honour(current_user["user_id"])
    if honour < 70:
        raise HTTPException(
            status_code=403,
            detail=f"Honour must be at least 70 to create a room. Your honour: {honour}"
        )

    name = data.name.strip()[:60]
    description = data.description.strip()[:200]
    if not name:
        raise HTTPException(status_code=400, detail="Room name is required")

    existing = rooms_collection.find_one({
        "host_id": current_user["user_id"],
        "status": "active"
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active room")

    now = datetime.now(timezone.utc)

    result = rooms_collection.insert_one({
        "name": name,
        "description": description,
        "host_id": current_user["user_id"],
        "host_name": current_user["name"],
        "status": "active",
        "created_at": now,
        "ended_at": None,
        "max_listeners": 10,
        "participant_count_cache": 1,
    })

    room_id = str(result.inserted_id)

    participants_collection.insert_one({
        "room_id": room_id,
        "user_id": current_user["user_id"],
        "user_name": current_user["name"],
        "role": "host",
        "joined_at": now,
        "left_at": None,
    })

    return {"room_id": room_id, "message": "Room created successfully"}


@router.get("/rooms")
def get_rooms(current_user: dict = Depends(get_current_user)):
    raw = list(rooms_collection.find({"status": "active"}).sort("created_at", -1))
    rooms = []
    for r in raw:
        room_id = str(r["_id"])
        rooms.append({
            "room_id": room_id,
            "name": r["name"],
            "description": r.get("description", ""),
            "host_name": r["host_name"],
            "host_id": r["host_id"],
            "participant_count": r.get("participant_count_cache", 1),
            "max_listeners": r.get("max_listeners", 10),
            "created_at": r["created_at"].isoformat(),
        })
    return {"rooms": rooms}


@router.get("/rooms/{room_id}")
def get_room_details(
    room_id: str,
    current_user: dict = Depends(get_current_user)
):
    room = _get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    raw_participants = list(participants_collection.find({
        "room_id": room_id,
        "left_at": None
    }))

    participants = [
        {
            "user_id": p["user_id"],
            "user_name": p["user_name"],
            "role": p["role"],
        }
        for p in raw_participants
    ]

    return {
        "room_id": room_id,
        "name": room["name"],
        "description": room.get("description", ""),
        "host_id": room["host_id"],
        "host_name": room["host_name"],
        "participant_count": len(participants),
        "participants": participants,
    }


@router.post("/rooms/{room_id}/join")
def join_room(
    room_id: str,
    current_user: dict = Depends(get_current_user)
):
    room = _get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    already = _get_active_room_participant(room_id, current_user["user_id"])
    if already:
        return {"message": "Already in room", "role": already["role"]}

    listener_count = participants_collection.count_documents({
        "room_id": room_id,
        "role": "listener",
        "left_at": None
    })
    if listener_count >= room.get("max_listeners", 10):
        raise HTTPException(status_code=400, detail="Room is full")

    participants_collection.insert_one({
        "room_id": room_id,
        "user_id": current_user["user_id"],
        "user_name": current_user["name"],
        "role": "listener",
        "joined_at": datetime.now(timezone.utc),
        "left_at": None,
    })

    rooms_collection.update_one(
        {"_id": ObjectId(room_id)},
        {"$inc": {"participant_count_cache": 1}}
    )

    return {"message": "Joined successfully", "role": "listener"}


@router.post("/rooms/{room_id}/leave")
def leave_room(
    room_id: str,
    current_user: dict = Depends(get_current_user)
):
    room = _get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    now = datetime.now(timezone.utc)
    uid = current_user["user_id"]

    participants_collection.update_one(
        {"room_id": room_id, "user_id": uid, "left_at": None},
        {"$set": {"left_at": now}}
    )

    rooms_collection.update_one(
        {"_id": ObjectId(room_id)},
        {"$inc": {"participant_count_cache": -1}}
    )

    _cleanup_user_from_room(room_id, uid)

    if room["host_id"] == uid:
        rooms_collection.update_one(
            {"_id": ObjectId(room_id)},
            {"$set": {"status": "ended", "ended_at": now}}
        )
        participants_collection.update_many(
            {"room_id": room_id, "left_at": None},
            {"$set": {"left_at": now}}
        )
        _cleanup_room(room_id)
        return {"message": "Room ended"}

    return {"message": "Left room"}


@router.post("/rooms/{room_id}/promote")
def promote_to_speaker(
    room_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    room = _get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room["host_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Only host can promote")

    target_user_id = data.get("user_id", "").strip()
    if not target_user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    try:
        ObjectId(target_user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    participant = _get_active_room_participant(room_id, target_user_id)
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    if participant["role"] != "listener":
        raise HTTPException(status_code=400, detail="User is not a listener")

    participants_collection.update_one(
        {"room_id": room_id, "user_id": target_user_id, "left_at": None},
        {"$set": {"role": "speaker"}}
    )
    hand_raises_collection.update_one(
        {"room_id": room_id, "user_id": target_user_id, "status": "pending"},
        {"$set": {"status": "accepted"}}
    )

    return {"message": "Promoted to speaker"}


@router.post("/rooms/{room_id}/demote")
def demote_to_listener(
    room_id: str,
    current_user: dict = Depends(get_current_user)
):
    room = _get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    uid = current_user["user_id"]
    participant = _get_active_room_participant(room_id, uid)
    if not participant:
        raise HTTPException(status_code=404, detail="Not in room")

    if participant["role"] != "speaker":
        raise HTTPException(status_code=400, detail="You are not a speaker")

    participants_collection.update_one(
        {"room_id": room_id, "user_id": uid, "left_at": None},
        {"$set": {"role": "listener"}}
    )

    return {"message": "Demoted to listener"}


@router.get("/rooms/{room_id}/agora-token")
def get_agora_token(
    room_id: str,
    current_user: dict = Depends(get_current_user)
):
    room = _get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    participant = _get_active_room_participant(room_id, current_user["user_id"])
    if not participant:
        raise HTTPException(status_code=403, detail="You are not in this room")

    app_id = os.getenv("AGORA_APP_ID")
    app_certificate = os.getenv("AGORA_APP_CERTIFICATE")

    if not app_id or not app_certificate:
        raise HTTPException(status_code=500, detail="Agora not configured")

    uid = current_user["user_id"]
    channel = room_id
    expiry = int(time.time()) + 3600

    agora_uid = int(uid[-8:], 16) % 100000000

    role = 1 if participant["role"] in ["host", "speaker"] else 2

    token = RtcTokenBuilder.buildTokenWithUid(
        app_id,
        app_certificate,
        channel,
        agora_uid,
        role,
        expiry
    )

    return {
        "token": token,
        "app_id": app_id,
        "channel": room_id,
        "uid": agora_uid,
        "role": participant["role"],
    }


@router.get("/rooms/{room_id}/history")
def get_room_chat_history(
    room_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        room = rooms_collection.find_one({"_id": ObjectId(room_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Room not found")

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    ever_participant = participants_collection.find_one({
        "room_id": room_id,
        "user_id": current_user["user_id"],
    })
    if not ever_participant:
        raise HTTPException(status_code=403, detail="You were not in this room")

    msgs = list(
        messages_collection.find({"room_id": room_id})
        .sort("sent_at", 1)
        .limit(100)
    )

    return {
        "messages": [
            {
                "message_id": str(m["_id"]),
                "sender_id": m["sender_id"],
                "sender_name": m["sender_name"],
                "text": m["text"],
                "sent_at": m["sent_at"].isoformat(),
            }
            for m in msgs
        ]
    }


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

@router.websocket("/ws/rooms/{room_id}/{user_id}")
async def room_websocket(
    websocket: WebSocket,
    room_id: str,
    user_id: str,
    token: str = Query(...)
):
    token_user_id = _verify_room_token(token)
    if token_user_id != user_id:
        await websocket.close(code=4001)
        return

    room = _get_room(room_id)
    if not room:
        await websocket.close(code=4002)
        return

    participant = _get_active_room_participant(room_id, user_id)
    if not participant:
        await websocket.close(code=4003)
        return

    await room_manager.connect(room_id, user_id, websocket)

    await room_manager.broadcast(room_id, {
        "type": "user_joined",
        "user_id": user_id,
        "user_name": participant["user_name"],
        "role": participant["role"],
    }, exclude_user_id=user_id)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "chat":
                text = data.get("text", "").strip()[:500]
                if not text:
                    continue

                is_chat_banned = db.room_chat_banned.find_one({
                    "room_id": room_id,
                    "user_id": user_id,
                })
                if is_chat_banned:
                    await room_manager.send(room_id, user_id, {
                        "type": "chat_blocked",
                        "reason": "You are banned from chatting in this room.",
                    })
                    continue

                now = datetime.now(timezone.utc)
                result = messages_collection.insert_one({
                    "room_id": room_id,
                    "sender_id": user_id,
                    "sender_name": participant["user_name"],
                    "text": text,
                    "sent_at": now,
                })

                await room_manager.broadcast(room_id, {
                    "type": "chat",
                    "message_id": str(result.inserted_id),
                    "sender_id": user_id,
                    "sender_name": participant["user_name"],
                    "text": text,
                    "sent_at": now.isoformat(),
                })

            elif msg_type == "hand_raise":
                current = _get_active_room_participant(room_id, user_id)
                if not current or current["role"] != "listener":
                    continue

                existing_raise = hand_raises_collection.find_one({
                    "room_id": room_id,
                    "user_id": user_id,
                    "status": "pending"
                })
                if existing_raise:
                    continue

                hand_raises_collection.insert_one({
                    "room_id": room_id,
                    "user_id": user_id,
                    "user_name": participant["user_name"],
                    "raised_at": datetime.now(timezone.utc),
                    "status": "pending",
                })

                fresh_room = _get_room(room_id)
                if fresh_room:
                    await room_manager.send(room_id, fresh_room["host_id"], {
                        "type": "hand_raised",
                        "user_id": user_id,
                        "user_name": participant["user_name"],
                    })

            elif msg_type == "promote":
                fresh_room = _get_room(room_id)
                if not fresh_room or fresh_room["host_id"] != user_id:
                    continue

                target_id = data.get("user_id", "").strip()
                if not target_id:
                    continue

                target = _get_active_room_participant(room_id, target_id)
                if not target or target["role"] != "listener":
                    continue

                participants_collection.update_one(
                    {"room_id": room_id, "user_id": target_id, "left_at": None},
                    {"$set": {"role": "speaker"}}
                )
                hand_raises_collection.update_one(
                    {"room_id": room_id, "user_id": target_id, "status": "pending"},
                    {"$set": {"status": "accepted"}}
                )

                await room_manager.broadcast(room_id, {
                    "type": "role_changed",
                    "user_id": target_id,
                    "new_role": "speaker",
                })

            elif msg_type == "demote_self":
                current = _get_active_room_participant(room_id, user_id)
                if not current or current["role"] != "speaker":
                    continue

                participants_collection.update_one(
                    {"room_id": room_id, "user_id": user_id, "left_at": None},
                    {"$set": {"role": "listener"}}
                )

                await room_manager.broadcast(room_id, {
                    "type": "role_changed",
                    "user_id": user_id,
                    "new_role": "listener",
                })

            elif msg_type == "force_demote":
                fresh_room = _get_room(room_id)
                if not fresh_room or fresh_room["host_id"] != user_id:
                    continue

                target_id = data.get("user_id", "").strip()
                if not target_id:
                    continue

                target = _get_active_room_participant(room_id, target_id)
                if not target or target["role"] != "speaker":
                    continue

                participants_collection.update_one(
                    {"room_id": room_id, "user_id": target_id, "left_at": None},
                    {"$set": {"role": "listener"}}
                )

                await room_manager.broadcast(room_id, {
                    "type": "role_changed",
                    "user_id": target_id,
                    "new_role": "listener",
                })

            elif msg_type == "chat_ban":
                fresh_room = _get_room(room_id)
                if not fresh_room or fresh_room["host_id"] != user_id:
                    continue

                target_id = data.get("user_id", "").strip()
                if not target_id or target_id == user_id:
                    continue

                target = _get_active_room_participant(room_id, target_id)
                if not target:
                    continue

                already_banned = db.room_chat_banned.find_one({
                    "room_id": room_id,
                    "user_id": target_id,
                })
                if already_banned:
                    continue

                db.room_chat_banned.insert_one({
                    "room_id": room_id,
                    "user_id": target_id,
                    "user_name": target["user_name"],
                    "banned_at": datetime.now(timezone.utc),
                    "banned_by": user_id,
                })

                await room_manager.send(room_id, target_id, {
                    "type": "you_are_chat_banned",
                })

                await room_manager.broadcast(room_id, {
                    "type": "participant_chat_banned",
                    "user_id": target_id,
                    "user_name": target["user_name"],
                })

            elif msg_type == "chat_unban":
                fresh_room = _get_room(room_id)
                if not fresh_room or fresh_room["host_id"] != user_id:
                    continue

                target_id = data.get("user_id", "").strip()
                if not target_id:
                    continue

                db.room_chat_banned.delete_one({
                    "room_id": room_id,
                    "user_id": target_id,
                })

                await room_manager.send(room_id, target_id, {
                    "type": "you_are_chat_unbanned",
                })

                await room_manager.broadcast(room_id, {
                    "type": "participant_chat_unbanned",
                    "user_id": target_id,
                    "user_name": target["user_name"],
                })

            elif msg_type in ["offer", "answer", "ice-candidate"]:
                target_id = data.get("target_id")
                if target_id:
                    data["sender_id"] = user_id
                    await room_manager.send(room_id, target_id, data)

    except WebSocketDisconnect:
        room_manager.disconnect(room_id, user_id)

        now = datetime.now(timezone.utc)
        participants_collection.update_one(
            {"room_id": room_id, "user_id": user_id, "left_at": None},
            {"$set": {"left_at": now}}
        )

        rooms_collection.update_one(
            {"_id": ObjectId(room_id)},
            {"$inc": {"participant_count_cache": -1}}
        )

        _cleanup_user_from_room(room_id, user_id)

        fresh_room = rooms_collection.find_one({"_id": ObjectId(room_id)})
        if not fresh_room:
            return

        if fresh_room["host_id"] == user_id:
            rooms_collection.update_one(
                {"_id": ObjectId(room_id)},
                {"$set": {"status": "ended", "ended_at": now}}
            )
            participants_collection.update_many(
                {"room_id": room_id, "left_at": None},
                {"$set": {"left_at": now}}
            )
            _cleanup_room(room_id)
            await room_manager.broadcast(room_id, {
                "type": "room_ended",
                "reason": "host_left",
            })
        else:
            await room_manager.broadcast(room_id, {
                "type": "user_left",
                "user_id": user_id,
                "user_name": participant["user_name"],
            })