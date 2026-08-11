import sqlite3

con = sqlite3.connect("novalabs.db")
cur = con.cursor()

fixes = {
    15: "Project 1 — Task Manager App",
    16: "Project 2 — Notes / Blog App",
    20: "Project 3 — SaaS Dashboard",
    28: "Project 4 — Open Build",
}
for num, title in fixes.items():
    cur.execute("UPDATE days SET title=? WHERE day_number=?", (title, num))

con.commit()

cur.execute("SELECT day_number, title FROM days ORDER BY day_number")
with open("day_titles_check.txt", "w", encoding="utf-8") as f:
    for row in cur.fetchall():
        f.write(f"{row[0]}: {row[1]}\n")
