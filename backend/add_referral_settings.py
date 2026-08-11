"""Adds the platform_settings table and payment_orders.referral_discount_applied.

`Base.metadata.create_all` creates new tables but never alters existing ones,
so the new column has to be added here. Safe to re-run.

    python add_referral_settings.py [path/to/db]
"""
import sqlite3
import sys

db_path = sys.argv[1] if len(sys.argv) > 1 else "novalabs.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute(
    """
CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(64) PRIMARY KEY,
    value INTEGER NOT NULL,
    updated_at DATETIME NOT NULL,
    updated_by VARCHAR(36)
)
"""
)
print("platform_settings ready")

existing = {row[1] for row in cursor.execute("PRAGMA table_info(payment_orders)")}
if "referral_discount_applied" not in existing:
    cursor.execute(
        "ALTER TABLE payment_orders ADD COLUMN referral_discount_applied INTEGER NOT NULL DEFAULT 0"
    )
    print("payment_orders.referral_discount_applied added")
else:
    print("payment_orders.referral_discount_applied already present")

conn.commit()
conn.close()
print(f"Done: {db_path}")
