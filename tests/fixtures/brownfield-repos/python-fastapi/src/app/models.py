from pydantic import BaseModel


class User(BaseModel):
    id: str
    email: str


class Order(BaseModel):
    id: str
    user_id: str
    total: float
