from fastapi import APIRouter
from fastapi import Depends

from datetime import datetime

from app.config.db import db
from app.middleware.auth_middleware import (
    get_current_user
)

router = APIRouter()

waiting_pool = db.waiting_pool
sessions_collection = db.sessions
users_collection = db.users


@router.post("/instant-connect/join")
def join_queue(
    current_user: dict = Depends(
        get_current_user
    )
):

    existing = waiting_pool.find_one({
        "user_id":
        current_user["user_id"]
    })

    if existing:

        return {

            "status":
            "waiting",

            "message":
            "Already in queue"

        }

    partner = waiting_pool.find_one({

        "user_id": {
            "$ne":
            current_user["user_id"]
        }

    })

    if partner:

        waiting_pool.delete_one({
            "_id":
            partner["_id"]
        })

        session_data = {

            "user_1":
            partner["user_id"],

            "user_2":
            current_user["user_id"],

            "status":
            "active",

            "started_at":
            datetime.utcnow()

        }

        session = sessions_collection.insert_one(
            session_data
        )

        partner_user = users_collection.find_one({

            "email":
            partner["email"]

        })

        return {

            "status":
            "matched",

            "session_id":
            str(
                session.inserted_id
            ),

            "partner": {

                "name":
                partner_user.get(
                    "name",
                    ""
                ),

                "email":
                partner_user.get(
                    "email",
                    ""
                ),

                "phone":
                partner_user.get(
                    "phone",
                    ""
                ),

                "interested_in":
                partner_user.get(
                    "interested_in",
                    ""
                ),

                "tagline":
                partner_user.get(
                    "tagline",
                    ""
                )

            }

        }

    waiting_pool.insert_one({

        "user_id":
        current_user["user_id"],

        "email":
        current_user["email"],

        "status":
        "waiting"

    })

    return {

        "status":
        "waiting",

        "message":
        "Added to waiting pool"

    }


@router.post("/instant-connect/cancel")
def cancel_queue(
    current_user: dict = Depends(
        get_current_user
    )
):

    waiting_pool.delete_one({

        "user_id":
        current_user["user_id"]

    })

    return {

        "message":
        "Removed from queue"

    }

@router.get("/instant-connect/status")
def get_status(
    current_user: dict = Depends(
        get_current_user
    )
):

    session = sessions_collection.find_one({

        "$or": [

            {
                "user_1":
                current_user["user_id"]
            },

            {
                "user_2":
                current_user["user_id"]
            }

        ],

        "status":
        "active"

    })

    if not session:

        return {
            "status": "waiting"
        }

    partner_id = (
        session["user_2"]
        if session["user_1"]
        == current_user["user_id"]
        else session["user_1"]
    )

    return {

        "status":
        "matched",

        "partner_id":
        partner_id,

        "session_id":
        str(session["_id"])

    }