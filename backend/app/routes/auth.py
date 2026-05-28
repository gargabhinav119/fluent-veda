from fastapi import APIRouter
from app.schemas.user_schema import UserSignup
from app.config.db import db
from app.services.auth_service import hash_password

router = APIRouter()

users_collection = db.users


@router.post("/signup")
def signup(user: UserSignup):

    existing_user = users_collection.find_one({
        "email": user.email
    })

    if existing_user:
        return {
            "message": "Email already exists"
        }

    hashed_password = hash_password(user.password)

    user_data = {
        "name": user.name,
        "email": user.email,
        "password": hashed_password
    }

    users_collection.insert_one(user_data)

    return {
        "message": "User created successfully"
    }