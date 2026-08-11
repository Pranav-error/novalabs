import json
import sqlite3
import sys
import uuid

BASE = r"C:\Users\SOFTHO~1\AppData\Local\Temp\claude\c--Users-Softhorizon-Development-lab-NOVALAB\bf1e99fc-21f9-4dcb-8708-f222e1060a8a\scratchpad"

batches = sys.argv[1:] if len(sys.argv) > 1 else []
if not batches:
    print("usage: python apply_mcqs.py <batch_num> [batch_num ...]")
    sys.exit(1)

con = sqlite3.connect("novalabs.db")
cur = con.cursor()

report = []
for b in batches:
    path = f"{BASE}\\mcq_batch{b}.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for day_num, questions in data.items():
        cur.execute("SELECT id FROM days WHERE day_number=?", (int(day_num),))
        row = cur.fetchone()
        if row is None:
            report.append(f"Day {day_num}: NOT FOUND, skipped")
            continue
        day_id = row[0]
        cur.execute("DELETE FROM mcq_questions WHERE day_id=?", (day_id,))
        for i, q in enumerate(questions):
            cur.execute(
                "INSERT INTO mcq_questions "
                "(id, day_id, question_text, options, correct_option_index, explanation, display_order) "
                "VALUES (?,?,?,?,?,?,?)",
                (
                    str(uuid.uuid4()),
                    day_id,
                    q["question_text"],
                    json.dumps(q["options"]),
                    int(q["correct_option_index"]),
                    q.get("explanation"),
                    i,
                ),
            )
        report.append(f"Day {day_num}: inserted {len(questions)} questions")

con.commit()

cur.execute(
    "SELECT d.day_number, COUNT(m.id) FROM days d LEFT JOIN mcq_questions m ON m.day_id = d.id "
    "GROUP BY d.day_number ORDER BY d.day_number"
)
with open("mcq_apply_check.txt", "w", encoding="utf-8") as f:
    for row in cur.fetchall():
        f.write(f"{row}\n")

print("\n".join(report))
