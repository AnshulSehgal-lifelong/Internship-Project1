from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass

from app.db.models import *