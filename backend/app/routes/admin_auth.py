from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from jose import jwt
from datetime import datetime, timezone, timedelta
import bcrypt
import os

router = APIRouter()

class AdminLoginRequest(BaseModel):
    username: str
    password: str

@router.post(f"/login")
async def admin_login(data: AdminLoginRequest, request: Request):
    client_ip = request.client.host
    if client_ip not in ["127.0.0.1", "::1"]:
        raise HTTPException(status_code=404, detail="Not found")

    stored_username = os.getenv("ADMIN_USERNAME")
    stored_hash = os.getenv("ADMIN_PASSWORD_HASH")

    # Timing attack se bachao — hamesha same time lagao
    username_match = data.username == stored_username
    password_match = bcrypt.checkpw(
        data.password.encode(),
        stored_hash.encode()
    )

    if not username_match or not password_match:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = jwt.encode(
        {
            "role": "admin",
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(hours=2),
        },
        os.getenv("ADMIN_JWT_SECRET"),
        algorithm="HS256"
    )

    return {"token": token}