from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from dotenv import load_dotenv
from bson import ObjectId
from app.config.db import db
import os

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")

ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="login"
)


def get_current_user(
    token: str = Depends(oauth2_scheme)
):

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("user_id")

        user = db.users.find_one({
            "_id": ObjectId(user_id)
        })

        if not user:

            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        return {
            "user_id": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "phone": user.get("phone", ""),
            "interested_in": user.get("interested_in", ""),
            "tagline": user.get("tagline", ""),
            "gender": user.get("gender", ""),
            "honour": user.get("honour", 50)


        }

    except JWTError:

        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )