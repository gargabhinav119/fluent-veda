from pymongo import MongoClient, ASCENDING, DESCENDING
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")

client = MongoClient(MONGO_URL)

db = client.fluentveda

# ── Rooms Indexes ─────────────────────────────────────────────────────────────

db.rooms.create_index([("status", ASCENDING), ("created_at", DESCENDING)])
db.rooms.create_index([("host_id", ASCENDING), ("status", ASCENDING)])

db.room_participants.create_index([("room_id", ASCENDING), ("user_id", ASCENDING)])
db.room_participants.create_index([("room_id", ASCENDING), ("left_at", ASCENDING)])
db.room_participants.create_index([("room_id", ASCENDING), ("role", ASCENDING), ("left_at", ASCENDING)])

db.room_messages.create_index([("room_id", ASCENDING), ("sent_at", ASCENDING)])

db.room_hand_raises.create_index([("room_id", ASCENDING), ("user_id", ASCENDING)])
db.room_hand_raises.create_index([("room_id", ASCENDING), ("status", ASCENDING)])

db.room_chat_banned.create_index([("room_id", ASCENDING), ("user_id", ASCENDING)], unique=True)

# ── Existing Collections Indexes ──────────────────────────────────────────────

db.sessions.create_index([("user_1", ASCENDING)])
db.sessions.create_index([("user_2", ASCENDING)])
db.sessions.create_index([("status", ASCENDING)])

db.messages.create_index([("sender_id", ASCENDING), ("receiver_id", ASCENDING)])
db.messages.create_index([("sent_at", ASCENDING)])