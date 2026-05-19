from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Admin:
    username: str
    password_hash: str
    email: str
    admin_id: Optional[str] = None
    created_at: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Admin":
        return cls(
            admin_id=data.get("admin_id"),
            username=data["username"],
            password_hash=data["password_hash"],
            email=data["email"],
            created_at=data.get("created_at"),
        )

    def to_safe_dict(self) -> dict:
        return {
            "admin_id": self.admin_id,
            "username": self.username,
            "email": self.email,
        }
