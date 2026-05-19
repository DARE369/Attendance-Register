from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import uuid


@dataclass
class AttendanceLog:
    student_id: str
    log_type: str  # "arrival" | "departure"
    scan_timestamp: datetime
    log_id: Optional[str] = None
    comments: Optional[str] = None   # "early" | "late" | None
    entry_point: Optional[str] = None
    created_at: Optional[datetime] = None

    def __post_init__(self):
        if self.log_id is None:
            self.log_id = str(uuid.uuid4())

    @classmethod
    def from_dict(cls, data: dict) -> "AttendanceLog":
        return cls(
            log_id=data.get("log_id"),
            student_id=data["student_id"],
            log_type=data["log_type"],
            scan_timestamp=data["scan_timestamp"],
            comments=data.get("comments"),
            entry_point=data.get("entry_point"),
            created_at=data.get("created_at"),
        )

    def to_dict(self) -> dict:
        return {
            "log_id": self.log_id,
            "student_id": self.student_id,
            "log_type": self.log_type,
            "scan_timestamp": self.scan_timestamp.isoformat() if isinstance(self.scan_timestamp, datetime) else self.scan_timestamp,
            "comments": self.comments,
            "entry_point": self.entry_point,
        }
