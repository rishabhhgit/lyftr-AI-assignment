import os
import aiosqlite
from app.config import get_settings


def get_db_path() -> str:
    settings = get_settings()
    db_url = settings.database_url
    if ":////" in db_url:
        return "/" + db_url.split(":////")[1]
    elif ":///" in db_url:
        return db_url.split(":///")[1]
    return db_url


async def init_db():
    db_path = get_db_path()
    if db_path and db_path != ":memory:" and not db_path.startswith(":"):
        dir_name = os.path.dirname(db_path)
        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)

    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL
            );
            """
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);"
        )
        await db.commit()


async def get_db():
    db_path = get_db_path()
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        yield db
