from fastapi import FastAPI
from app.config.db import db
from app.routes.auth import router as auth_router

app = FastAPI()

app.include_router(auth_router)

@app.get("/")
def root():
    return {"message": "FluentVeda Backend Running"}


@app.get("/test-db")
def test_db():
    return {
        "collections": db.list_collection_names()
    }