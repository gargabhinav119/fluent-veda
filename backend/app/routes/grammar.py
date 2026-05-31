from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from bson import ObjectId
from app.config.db import db
from app.middleware.auth_middleware import get_current_user
from app.middleware.admin_middleware import get_current_admin
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class GrammarArticleRequest(BaseModel):
    title: str
    content: str
    category: str  # tenses / articles / prepositions / punctuation / other
    difficulty: str  # beginner / intermediate / advanced
    read_time_minutes: int = 5
    published: bool = True

# ── Admin Routes ──────────────────────────────────────────────────────────────

@router.post("/admin/grammar")
def add_grammar_article(
    data: GrammarArticleRequest,
    admin=Depends(get_current_admin)
):
    now = datetime.now(timezone.utc)
    result = db.grammar_articles.insert_one({
        "title": data.title.strip(),
        "content": data.content.strip(),
        "category": data.category.strip(),
        "difficulty": data.difficulty.strip(),
        "read_time_minutes": data.read_time_minutes,
        "published": data.published,
        "created_at": now,
        "created_by": "admin"
    })

    return {"message": "Article added successfully", "article_id": str(result.inserted_id)}


@router.get("/admin/grammar")
def get_all_articles(admin=Depends(get_current_admin)):
    articles = list(db.grammar_articles.find().sort("created_at", -1))
    return {
        "articles": [
            {
                "article_id": str(a["_id"]),
                "title": a["title"],
                "category": a["category"],
                "difficulty": a["difficulty"],
                "published": a["published"],
                "created_at": a["created_at"].isoformat(),
            }
            for a in articles
        ]
    }


@router.patch("/admin/grammar/{article_id}/toggle")
def toggle_publish(article_id: str, admin=Depends(get_current_admin)):
    try:
        article = db.grammar_articles.find_one({"_id": ObjectId(article_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid article ID")

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    new_status = not article["published"]
    db.grammar_articles.update_one(
        {"_id": ObjectId(article_id)},
        {"$set": {"published": new_status}}
    )

    return {"message": "Updated", "published": new_status}


@router.delete("/admin/grammar/{article_id}")
def delete_article(article_id: str, admin=Depends(get_current_admin)):
    try:
        result = db.grammar_articles.delete_one({"_id": ObjectId(article_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid article ID")

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Article not found")

    return {"message": "Article deleted successfully"}


# ── User Routes ───────────────────────────────────────────────────────────────

@router.get("/grammar")
def get_grammar_articles(
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    current_user=Depends(get_current_user)
):
    uid = current_user["user_id"]

    query = {"published": True}
    if category:
        query["category"] = category
    if difficulty:
        query["difficulty"] = difficulty

    articles = list(db.grammar_articles.find(query).sort("created_at", -1))

    article_ids = [str(a["_id"]) for a in articles]
    acks = db.grammar_acknowledgements.find({
        "user_id": uid,
        "article_id": {"$in": article_ids}
    })
    acked_ids = {a["article_id"] for a in acks}

    return {
        "articles": [
            {
                "article_id": str(a["_id"]),
                "title": a["title"],
                "category": a["category"],
                "difficulty": a["difficulty"],
                "read_time_minutes": a["read_time_minutes"],
                "acknowledged": str(a["_id"]) in acked_ids,
                "created_at": a["created_at"].isoformat(),
            }
            for a in articles
        ]
    }


@router.get("/grammar/{article_id}")
def get_grammar_article(article_id: str, current_user=Depends(get_current_user)):
    uid = current_user["user_id"]

    try:
        article = db.grammar_articles.find_one({
            "_id": ObjectId(article_id),
            "published": True
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid article ID")

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    ack = db.grammar_acknowledgements.find_one({
        "user_id": uid,
        "article_id": article_id
    })

    return {
        "article_id": str(article["_id"]),
        "title": article["title"],
        "content": article["content"],
        "category": article["category"],
        "difficulty": article["difficulty"],
        "read_time_minutes": article["read_time_minutes"],
        "acknowledged": ack is not None,
        "created_at": article["created_at"].isoformat(),
    }


@router.post("/grammar/{article_id}/acknowledge")
def acknowledge_article(article_id: str, current_user=Depends(get_current_user)):
    uid = current_user["user_id"]

    try:
        article = db.grammar_articles.find_one({
            "_id": ObjectId(article_id),
            "published": True
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid article ID")

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    try:
        db.grammar_acknowledgements.insert_one({
            "user_id": uid,
            "article_id": article_id,
            "acknowledged_at": datetime.now(timezone.utc)
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Already acknowledged")

    # Honour +1
    db.users.update_one(
        {"_id": ObjectId(uid)},
        {"$inc": {"honour": 1}}
    )

    return {"message": "Acknowledged", "honour_added": 1}