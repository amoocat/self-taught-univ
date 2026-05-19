from typing import Any, Type, TypeVar
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

_M = TypeVar("_M")


class STUError(Exception):
    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(self, detail: str = ""):
        self.detail = detail
        super().__init__(detail)


class NotFoundError(STUError):
    status_code = 404
    code = "NOT_FOUND"


class BadRequestError(STUError):
    status_code = 400
    code = "BAD_REQUEST"


class ConflictError(STUError):
    status_code = 409
    code = "CONFLICT"


async def stu_error_handler(request: Request, exc: STUError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.code, "detail": exc.detail},
    )


async def get_or_404(db: AsyncSession, model: Type[_M], id_: Any, label: str = "") -> _M:
    """DB에서 pk로 조회; 없거나 잘못된 UUID면 NotFoundError(404)"""
    label = label or model.__name__
    try:
        obj = await db.get(model, id_)
    except DBAPIError:
        raise NotFoundError(f"{label} not found")
    if obj is None:
        raise NotFoundError(f"{label} not found")
    return obj
