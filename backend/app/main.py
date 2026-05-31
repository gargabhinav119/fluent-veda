import os
from fastapi import FastAPI
from app.config.db import db
from app.routes.auth import router as auth_router
from app.routes.admin_auth import router as admin_auth_router
from fastapi.middleware.cors import CORSMiddleware
from app.routes.instant_connect import router as instant_connect_router
from app.routes.chat import router as chat_router
from app.routes.rooms import router as rooms_router
from app.indexes import create_indexes
from app.routes.vocabulary import router as vocabulary_router
from app.routes.grammar import router as grammar_router
from app.routes.quiz import router as quiz_router

app = FastAPI(
    docs_url=None if os.getenv("ENV") == "production" else "/docs",
    redoc_url=None if os.getenv("ENV") == "production" else "/redoc",
    openapi_url=None if os.getenv("ENV") == "production" else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

admin_prefix = os.getenv("ADMIN_PREFIX", "mgmt")

app.include_router(auth_router)
app.include_router(instant_connect_router)
app.include_router(chat_router)
app.include_router(rooms_router)
app.include_router(admin_auth_router, prefix=f"/{admin_prefix}")
app.include_router(vocabulary_router)
app.include_router(grammar_router)
app.include_router(quiz_router)

# app banane ke baad, routes se pehle
create_indexes()


@app.get("/")
def root():
    return {"message": "FluentVeda Backend Running"}

@app.get("/test-db")
def test_db():
    return {
        "collections": db.list_collection_names()
    }