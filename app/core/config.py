from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://stu:stu@localhost:5432/stu"
    REDIS_URL: str = "redis://localhost:6379/0"
    DEBUG: bool = False
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]
    CHATGPT_API_KEY: str = ""
    YOUTUBE_API_KEY: str = ""
    YOUTUBE_OAUTH_CLIENT: str = ""

    model_config = {"env_file": ".env", "extra": "allow"}


settings = Settings()
