from motor.motor_asyncio import AsyncIOMotorClient
from app.config import get_settings

settings = get_settings()

client: AsyncIOMotorClient = None
database = None


async def get_database():
    global database
    if database is None:
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        database = client[settings.MONGODB_DB]
    return database


async def connect_db():
    global client, database
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    database = client[settings.MONGODB_DB]
    print(f"Connected to MongoDB: {settings.MONGODB_DB}")


async def close_db():
    global client
    if client:
        client.close()


def get_collection(name: str):
    return database[name]