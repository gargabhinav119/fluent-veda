from fastapi import Request, HTTPException
from jose import jwt, JWTError
import os

async def get_current_admin(request: Request):
    client_ip = request.client.host
    if client_ip not in ["127.0.0.1", "::1"]:
        raise HTTPException(status_code=404, detail="Not found")

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = auth_header.split(" ")[1]

    try:
        payload = jwt.decode(
            token,
            os.getenv("ADMIN_JWT_SECRET"),
            algorithms=["HS256"]
        )
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Forbidden")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")