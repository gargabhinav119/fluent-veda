from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from bson import ObjectId
from app.config.db import db
from app.middleware.auth_middleware import get_current_user
from app.middleware.admin_middleware import get_current_admin
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class VocabWordRequest(BaseModel):
    word: str
    meaning: str
    example: str
    part_of_speech: str
    detailed_explanation: str
    pronunciation: str
    synonyms: list[str] = []
    date: str  # YYYY-MM-DD

# ── Admin Routes ──────────────────────────────────────────────────────────────

@router.post("/admin/vocabulary")
def add_vocab_word(
    data: VocabWordRequest,
    admin=Depends(get_current_admin)
):
    existing = db.vocab_words.find_one({"date": data.date})
    if existing:
        raise HTTPException(status_code=400, detail="Word for this date already exists")

    now = datetime.now(timezone.utc)
    result = db.vocab_words.insert_one({
        "word": data.word.strip(),
        "meaning": data.meaning.strip(),
        "example": data.example.strip(),
        "part_of_speech": data.part_of_speech.strip(),
        "detailed_explanation": data.detailed_explanation.strip(),
        "pronunciation": data.pronunciation.strip(),
        "synonyms": [s.strip() for s in data.synonyms],
        "date": data.date,
        "created_at": now,
        "created_by": "admin"
    })

    return {"message": "Word added successfully", "word_id": str(result.inserted_id)}


@router.get("/admin/vocabulary")
def get_all_vocab_words(admin=Depends(get_current_admin)):
    words = list(db.vocab_words.find().sort("date", -1))
    return {
        "words": [
            {
                "word_id": str(w["_id"]),
                "word": w["word"],
                "date": w["date"],
                "part_of_speech": w["part_of_speech"],
            }
            for w in words
        ]
    }


@router.delete("/admin/vocabulary/{word_id}")
def delete_vocab_word(word_id: str, admin=Depends(get_current_admin)):
    try:
        result = db.vocab_words.delete_one({"_id": ObjectId(word_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid word ID")

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Word not found")

    return {"message": "Word deleted successfully"}


# ── User Routes ───────────────────────────────────────────────────────────────

@router.get("/vocabulary")
def get_vocabulary(current_user=Depends(get_current_user)):
    uid = current_user["user_id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Aaj ka word
    today_word = db.vocab_words.find_one({"date": today})

    # Purane words
    past_words = list(
        db.vocab_words.find({"date": {"$lt": today}}).sort("date", -1).limit(20)
    )

    # Check acknowledgements
    all_word_ids = []
    if today_word:
        all_word_ids.append(str(today_word["_id"]))
    all_word_ids += [str(w["_id"]) for w in past_words]

    acks = db.vocab_acknowledgements.find({
        "user_id": uid,
        "word_id": {"$in": all_word_ids}
    })
    acked_ids = {a["word_id"] for a in acks}

    def format_word(w, is_today=False):
        wid = str(w["_id"])
        return {
            "word_id": wid,
            "word": w["word"],
            "meaning": w["meaning"],
            "example": w["example"],
            "part_of_speech": w["part_of_speech"],
            "detailed_explanation": w["detailed_explanation"] if is_today else None,
            "pronunciation": w["pronunciation"],
            "synonyms": w.get("synonyms", []),
            "date": w["date"],
            "acknowledged": wid in acked_ids,
        }

    return {
        "today": format_word(today_word, is_today=True) if today_word else None,
        "history": [format_word(w) for w in past_words],
    }


@router.post("/vocabulary/{word_id}/acknowledge")
def acknowledge_word(word_id: str, current_user=Depends(get_current_user)):
    uid = current_user["user_id"]

    try:
        word = db.vocab_words.find_one({"_id": ObjectId(word_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid word ID")

    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    try:
        db.vocab_acknowledgements.insert_one({
            "user_id": uid,
            "word_id": word_id,
            "acknowledged_at": datetime.now(timezone.utc)
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Already acknowledged")

    # Honour +2
    db.users.update_one(
        {"_id": ObjectId(uid)},
        {"$inc": {"honour": 2}}
    )

    return {"message": "Acknowledged", "honour_added": 2}