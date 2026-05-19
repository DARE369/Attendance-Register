"""
Loads mock_students.csv into Supabase and creates 2 test admin accounts.

Prerequisites:
  1. Copy .env.example to .env and fill in your Supabase credentials.
  2. Run: python generate_mock_data.py   (creates mock_students.csv)
  3. Run: python load_mock_data.py

Usage:
  python load_mock_data.py
"""
import csv
import sys
from dotenv import load_dotenv

load_dotenv()

from services import supabase_client as db
from services.auth_service import hash_password

CSV_FILE = "mock_students.csv"

TEST_ADMINS = [
    {"username": "admin1", "password": "test123", "email": "admin1@peculiarschool.com"},
    {"username": "admin2", "password": "test123", "email": "admin2@peculiarschool.com"},
]


def load_students() -> int:
    loaded = 0
    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                db.upsert_student(row)
                loaded += 1
            except Exception as exc:
                print(f"  SKIP {row['student_id']}: {exc}")
    return loaded


def load_admins() -> int:
    loaded = 0
    for admin in TEST_ADMINS:
        try:
            payload = {
                "username": admin["username"],
                "password_hash": hash_password(admin["password"]),
                "email": admin["email"],
            }
            db.upsert_admin(payload)
            loaded += 1
            print(f"  Upserted admin: {admin['username']}")
        except Exception as exc:
            print(f"  SKIP admin {admin['username']}: {exc}")
    return loaded


def main():
    print("=== Peculiar Register — Mock Data Loader ===\n")

    print(f"Loading students from {CSV_FILE}...")
    students_loaded = load_students()

    print("\nCreating test admin accounts...")
    admins_loaded = load_admins()

    print(f"\nLoaded {students_loaded} students and {admins_loaded} admins.")
    print("\nTest credentials:")
    for a in TEST_ADMINS:
        print(f"  username={a['username']}  password={a['password']}")


if __name__ == "__main__":
    main()
