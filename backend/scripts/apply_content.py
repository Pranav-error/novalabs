import json
import sqlite3
import sys

BASE = r"C:\Users\SOFTHO~1\AppData\Local\Temp\claude\c--Users-Softhorizon-Development-lab-NOVALAB\bf1e99fc-21f9-4dcb-8708-f222e1060a8a\scratchpad"

phases = sys.argv[1:] if len(sys.argv) > 1 else ["1", "2", "3", "4", "5", "6"]

con = sqlite3.connect("novalabs.db")
cur = con.cursor()

applied = []
for p in phases:
    path = f"{BASE}\\phase{p}_content.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for day_num, fields in data.items():
        cur.execute(
            "UPDATE days SET lesson_content=?, assignment_prompt=?, starter_code=? WHERE day_number=?",
            (fields["lesson_content"], fields["assignment_prompt"], fields["starter_code"], int(day_num)),
        )
        applied.append(int(day_num))

con.commit()

cur.execute("SELECT day_number, title, length(lesson_content), length(assignment_prompt), length(starter_code) FROM days ORDER BY day_number")
with open("content_apply_check.txt", "w", encoding="utf-8") as f:
    for row in cur.fetchall():
        f.write(f"{row}\n")

print(f"Applied {len(applied)} days: {sorted(applied)}")
