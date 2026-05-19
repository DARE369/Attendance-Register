from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Student:
    student_id: str
    full_name: str
    class_name: str
    parent_phone: str
    parent_email: str
    created_at: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Student":
        return cls(
            student_id=data["student_id"],
            full_name=data["full_name"],
            class_name=data["class"],
            parent_phone=data["parent_phone"],
            parent_email=data["parent_email"],
            created_at=data.get("created_at"),
        )

    def to_dict(self) -> dict:
        return {
            "student_id": self.student_id,
            "full_name": self.full_name,
            "class": self.class_name,
            "parent_phone": self.parent_phone,
            "parent_email": self.parent_email,
        }
