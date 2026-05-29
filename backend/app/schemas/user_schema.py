from pydantic import BaseModel, EmailStr
from typing import Optional


class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    name: str
    phone: str
    interested_in: str
    tagline: str
    gender: Optional[str] = None