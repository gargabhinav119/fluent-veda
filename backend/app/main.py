from fastapi import FastAPI
from app.config.db import db

app = FastAPI()

@app.get("/")
def root():
    return {"message": "FluentVeda Backend Running"}

@app.get("/test-db")
def test_db():
    return {
        "collections": db.list_collection_names()
    }