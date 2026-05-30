from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, HTTPException
from datetime import datetime, timezone
from bson import ObjectId
from app.config.db import db
from app.middleware.auth_middleware import get_current_user
from jose import jwt, JWTError
import os

router = APIRouter()

messages_collection = db.messages
users_collection = db.users

# ── Security constants ────────────────────────────────────────────────────────
MAX_MESSAGE_LENGTH = 500
MAX_MESSAGES_FETCH = 50

# ── Connection Manager ────────────────────────────────────────────────────────
class ChatConnectionManager:
    def __init__(self):
        self.active: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active[user_id] = websocket

    def disconnect(self, user_id: str):
        self.active.pop(user_id, None)

    async def send(self, user_id: str, message: dict):
        ws = self.active.get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(user_id)

manager = ChatConnectionManager()

# ── Helper ────────────────────────────────────────────────────────────────────
def verify_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, os.getenv("JWT_SECRET"), algorithms=["HS256"])
        return payload.get("user_id")
    except JWTError:
        return None

def are_chat_partners(user_id_1: str, user_id_2: str) -> bool:
    """Sirf wahi users chat kar sakte hain jinke beech koi session rahi ho."""
    session = db.sessions.find_one({
        "$or": [
            {"user_1": user_id_1, "user_2": user_id_2},
            {"user_1": user_id_2, "user_2": user_id_1},
        ],
        "status": "ended",
    })
    return session is not None

# ── REST: fetch message history ───────────────────────────────────────────────
@router.get("/chat/history/{partner_id}")
def get_chat_history(
    partner_id: str,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["user_id"]

    # Security: sirf call partners hi chat dekh sakte hain
    if not are_chat_partners(uid, partner_id):
        raise HTTPException(status_code=403, detail="Not authorized to view this chat")

    msgs = list(
        messages_collection.find(
            {
                "$or": [
                    {"sender_id": uid, "receiver_id": partner_id},
                    {"sender_id": partner_id, "receiver_id": uid},
                ]
            }
        )
        .sort("sent_at", 1)
        .limit(MAX_MESSAGES_FETCH)
    )

    return {
        "messages": [
            {
                "message_id": str(m["_id"]),
                "sender_id": m["sender_id"],
                "text": m["text"],
                "sent_at": m["sent_at"].isoformat(),
            }
            for m in msgs
        ]
    }

# ── WebSocket: real-time chat ─────────────────────────────────────────────────
@router.websocket("/ws/chat/{user_id}")
async def chat_websocket(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(...),
):
    # Security: token verify karo
    token_user_id = verify_token(token)
    if token_user_id != user_id:
        await websocket.close(code=4001)
        return

    await manager.connect(user_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()

            receiver_id = data.get("receiver_id", "").strip()
            text = data.get("text", "").strip()

            # Security: empty ya bahut lamba message reject karo
            if not text or len(text) > MAX_MESSAGE_LENGTH:
                await manager.send(user_id, {"error": "Invalid message"})
                continue

            # Security: sirf call partners ko message bhej sakte ho
            if not are_chat_partners(user_id, receiver_id):
                await manager.send(user_id, {"error": "Not authorized"})
                continue

            # MongoDB mein save karo
            now = datetime.now(timezone.utc)
            result = messages_collection.insert_one({
                "sender_id": user_id,
                "receiver_id": receiver_id,
                "text": text,
                "sent_at": now,
            })

            message_payload = {
                "message_id": str(result.inserted_id),
                "sender_id": user_id,
                "receiver_id": receiver_id,
                "text": text,
                "sent_at": now.isoformat(),
            }

            # Sender ko confirm bhejo
            await manager.send(user_id, message_payload)

            # Receiver ko deliver karo agar online hai
            await manager.send(receiver_id, message_payload)

    except WebSocketDisconnect:
        manager.disconnect(user_id)