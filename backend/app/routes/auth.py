from fastapi import APIRouter
from fastapi import Depends
from app.middleware.auth_middleware import get_current_user
from app.middleware.auth_middleware import get_current_user
from app.schemas.user_schema import (
    UserSignup,
    UserLogin
)

from app.config.db import db

from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token
)

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

    hashed_password = hash_password(
        user.password
    )

    user_data = {
        "name": user.name,
        "email": user.email,
        "password": hashed_password
    }

    users_collection.insert_one(user_data)

    return {
        "message": "User created successfully"
    }


@router.post("/login")
def login(user: UserLogin):

    existing_user = users_collection.find_one({
        "email": user.email
    })

    if not existing_user:
        return {
            "message": "Invalid email"
        }

    password_correct = verify_password(
        user.password,
        existing_user["password"]
    )

    if not password_correct:
        return {
            "message": "Invalid password"
        }

    token = create_access_token({
        "user_id": str(existing_user["_id"]),
        "email": existing_user["email"]
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }
@router.get("/profile")
def profile(current_user: dict = Depends(get_current_user)):

    return {
        "message": "Profile fetched successfully",
        "user": current_user
    }