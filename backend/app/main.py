from fastapi import FastAPI
from app.config.db import db
from app.routes.auth import router as auth_router
from fastapi.middleware.cors import CORSMiddleware
from app.routes.instant_connect import (
    router as instant_connect_router
)
from app.routes.chat import router as chat_router
from app.routes.rooms import router as rooms_router

app = FastAPI()
app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:3000"
    ],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(
    instant_connect_router
)
app.include_router(chat_router)
app.include_router(rooms_router)

@app.get("/")
def root():
    return {"message": "FluentVeda Backend Running"}


@app.get("/test-db")
def test_db():
    return {
        "collections": db.list_collection_names()
    }