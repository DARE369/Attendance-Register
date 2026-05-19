"""
Generates mock_students.csv with 50 students (10 per class).
Run: python generate_mock_data.py
"""
import csv
import random

CLASSES = ["Year 9A", "Year 10A", "Year 10B", "Year 11A", "Year 11B"]

FIRST_NAMES = [
    "Amara", "Chisom", "David", "Emeka", "Fatima",
    "Grace", "Hassan", "Ifeoma", "James", "Kemi",
    "Liam", "Musa", "Ngozi", "Obinna", "Patience",
    "Quadri", "Rita", "Samuel", "Tunde", "Uche",
    "Victor", "Winifred", "Xavier", "Yetunde", "Zainab",
    "Adaeze", "Bello", "Chukwu", "Dami", "Eniola",
    "Femi", "Gbenga", "Halima", "Idris", "Jumoke",
    "Kehinde", "Lanre", "Miriam", "Nkem", "Oluwaseun",
    "Pelumi", "Rasheed", "Seun", "Taiwo", "Uchenna",
    "Valentine", "Wura", "Xena", "Yemi", "Zara",
]

LAST_NAMES = [
    "Adeyemi", "Balogun", "Chukwu", "Dada", "Eze",
    "Fashola", "Ganiyu", "Hassan", "Ibrahim", "Johnson",
    "Kalu", "Lawal", "Musa", "Nwosu", "Okafor",
    "Peters", "Quadri", "Raji", "Salami", "Taiwo",
]


def phone():
    suffix = "".join(str(random.randint(0, 9)) for _ in range(8))
    return f"+2547{suffix}"


def email(first: str, last: str) -> str:
    return f"{first.lower()}.{last.lower()}@peculiarschool.com"


def generate():
    students = []
    student_num = 1
    for cls in CLASSES:
        first_pool = random.sample(FIRST_NAMES, 10)
        last_pool = random.sample(LAST_NAMES, 10)
        for i in range(10):
            first = first_pool[i]
            last = last_pool[i]
            students.append({
                "student_id": f"STU{student_num:03d}",
                "full_name": f"{first} {last}",
                "class": cls,
                "parent_phone": phone(),
                "parent_email": email(first, last),
            })
            student_num += 1
    return students


def main():
    students = generate()
    fieldnames = ["student_id", "full_name", "class", "parent_phone", "parent_email"]
    with open("mock_students.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(students)
    print(f"Generated {len(students)} students -> mock_students.csv")
    print("\nFirst 10 rows:")
    for s in students[:10]:
        print(f"  {s['student_id']}  {s['full_name']:<22}  {s['class']:<10}  {s['parent_phone']}  {s['parent_email']}")


if __name__ == "__main__":
    main()
