from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from bson import ObjectId
from app.config.db import db
from app.middleware.auth_middleware import get_current_user
from app.middleware.admin_middleware import get_current_admin
from pydantic import BaseModel

router = APIRouter()

class QuizQuestion(BaseModel):
    text: str
    options: list[str]  # 4 options
    correct_answer: str  # option ka text, index nahi
    explanation: str

class QuizRequest(BaseModel):
    title: str
    date: str  # YYYY-MM-DD
    questions: list[QuizQuestion]

class QuizSubmitRequest(BaseModel):
    answers: list[str]  # user ke selected option texts

# ── Admin Routes ──────────────────────────────────────────────────────────────

@router.post("/admin/quiz")
def add_quiz(data: QuizRequest, admin=Depends(get_current_admin)):
    if len(data.questions) != 10:
        raise HTTPException(status_code=400, detail="Exactly 10 questions required")

    existing = db.quizzes.find_one({"date": data.date})
    if existing:
        raise HTTPException(status_code=400, detail="Quiz for this date already exists")

    # Validate har question mein correct_answer options mein hai
    for i, q in enumerate(data.questions):
        if len(q.options) != 4:
            raise HTTPException(status_code=400, detail=f"Question {i+1} must have exactly 4 options")
        if q.correct_answer not in q.options:
            raise HTTPException(status_code=400, detail=f"Question {i+1} correct_answer must match one of the options")

    now = datetime.now(timezone.utc)
    result = db.quizzes.insert_one({
        "title": data.title.strip(),
        "date": data.date,
        "questions": [
            {
                "question_id": f"q{i+1}",
                "text": q.text.strip(),
                "options": q.options,
                "correct_answer": q.correct_answer,
                "explanation": q.explanation.strip(),
            }
            for i, q in enumerate(data.questions)
        ],
        "created_at": now,
        "created_by": "admin"
    })

    return {"message": "Quiz added successfully", "quiz_id": str(result.inserted_id)}


@router.get("/admin/quiz")
def get_all_quizzes(admin=Depends(get_current_admin)):
    quizzes = list(db.quizzes.find().sort("date", -1))
    return {
        "quizzes": [
            {
                "quiz_id": str(q["_id"]),
                "title": q["title"],
                "date": q["date"],
                "created_at": q["created_at"].isoformat(),
            }
            for q in quizzes
        ]
    }


@router.delete("/admin/quiz/{quiz_id}")
def delete_quiz(quiz_id: str, admin=Depends(get_current_admin)):
    try:
        result = db.quizzes.delete_one({"_id": ObjectId(quiz_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid quiz ID")

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quiz not found")

    return {"message": "Quiz deleted successfully"}


# ── User Routes ───────────────────────────────────────────────────────────────

@router.get("/quiz/today")
def get_today_quiz(current_user=Depends(get_current_user)):
    uid = current_user["user_id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    quiz = db.quizzes.find_one({"date": today})
    if not quiz:
        return {"quiz": None, "message": "No quiz today, come back tomorrow!"}

    quiz_id = str(quiz["_id"])

    # Check attempt
    attempt = db.quiz_attempts.find_one({
        "user_id": uid,
        "quiz_id": quiz_id
    })

    if attempt:
        # Already attempted — result dikhao
        return {
            "quiz_id": quiz_id,
            "title": quiz["title"],
            "already_attempted": True,
            "score": attempt["score"],
            "passed": attempt["passed"],
            "honour_awarded": attempt["honour_awarded"],
            "questions": [
                {
                    "question_id": q["question_id"],
                    "text": q["text"],
                    "options": q["options"],
                    "correct_answer": q["correct_answer"],
                    "explanation": q["explanation"],
                    "user_answer": attempt["answers"][i] if i < len(attempt["answers"]) else None,
                }
                for i, q in enumerate(quiz["questions"])
            ]
        }

    # Correct answer hide karo — attempt nahi kiya abhi tak
    return {
        "quiz_id": quiz_id,
        "title": quiz["title"],
        "already_attempted": False,
        "questions": [
            {
                "question_id": q["question_id"],
                "text": q["text"],
                "options": q["options"],
            }
            for q in quiz["questions"]
        ]
    }


@router.post("/quiz/today/submit")
def submit_quiz(data: QuizSubmitRequest, current_user=Depends(get_current_user)):
    uid = current_user["user_id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    quiz = db.quizzes.find_one({"date": today})
    if not quiz:
        raise HTTPException(status_code=404, detail="No quiz today")

    quiz_id = str(quiz["_id"])

    # Already attempted check
    existing = db.quiz_attempts.find_one({
        "user_id": uid,
        "quiz_id": quiz_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already attempted today's quiz")

    if len(data.answers) != 10:
        raise HTTPException(status_code=400, detail="Must answer all 10 questions")

    # Score calculate karo
    score = 0
    for i, question in enumerate(quiz["questions"]):
        if i < len(data.answers) and data.answers[i] == question["correct_answer"]:
            score += 1

    passed = score >= 8
    honour_awarded = False

    # Attempt save karo
    db.quiz_attempts.insert_one({
        "user_id": uid,
        "quiz_id": quiz_id,
        "date": today,
        "answers": data.answers,
        "score": score,
        "passed": passed,
        "honour_awarded": passed,
        "submitted_at": datetime.now(timezone.utc)
    })

    # Honour +2 agar pass
    if passed:
        db.users.update_one(
            {"_id": ObjectId(uid)},
            {"$inc": {"honour": 2}}
        )
        honour_awarded = True

    return {
        "score": score,
        "total": 10,
        "passed": passed,
        "honour_awarded": honour_awarded,
        "honour_added": 2 if honour_awarded else 0,
        "questions": [
            {
                "question_id": q["question_id"],
                "text": q["text"],
                "options": q["options"],
                "correct_answer": q["correct_answer"],
                "explanation": q["explanation"],
                "user_answer": data.answers[i] if i < len(data.answers) else None,
                "correct": data.answers[i] == q["correct_answer"] if i < len(data.answers) else False,
            }
            for i, q in enumerate(quiz["questions"])
        ]
    }