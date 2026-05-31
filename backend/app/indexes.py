from app.config.db import db

def create_indexes():
    # Vocabulary
    db.vocab_words.create_index("date", unique=True)
    db.vocab_words.create_index([("created_at", -1)])
    db.vocab_acknowledgements.create_index(
        [("user_id", 1), ("word_id", 1)], unique=True
    )

    # Grammar
    db.grammar_articles.create_index([("published", 1), ("created_at", -1)])
    db.grammar_articles.create_index([("category", 1), ("difficulty", 1)])
    db.grammar_acknowledgements.create_index(
        [("user_id", 1), ("article_id", 1)], unique=True
    )

    # Quiz
    db.quizzes.create_index("date", unique=True)
    db.quiz_attempts.create_index(
        [("user_id", 1), ("quiz_id", 1)], unique=True
    )
    db.quiz_attempts.create_index([("user_id", 1), ("date", 1)])