import sqlite3

conn = sqlite3.connect("novalabs.db")
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS feed_posts (
    id VARCHAR(36) PRIMARY KEY,
    author_id VARCHAR(36) NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    category VARCHAR(10) NOT NULL DEFAULT 'general' CHECK(category IN ('progress', 'project', 'doubt', 'general')),
    likes_count INTEGER NOT NULL DEFAULT 0,
    replies_count INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS feed_replies (
    id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(36) NOT NULL REFERENCES feed_posts(id),
    author_id VARCHAR(36) NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS feed_likes (
    id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(36) NOT NULL REFERENCES feed_posts(id),
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL
)
""")

# Useful indexes
cursor.execute("CREATE INDEX IF NOT EXISTS ix_feed_posts_author_id ON feed_posts(author_id)")
cursor.execute("CREATE INDEX IF NOT EXISTS ix_feed_posts_category ON feed_posts(category)")
cursor.execute("CREATE INDEX IF NOT EXISTS ix_feed_posts_created_at ON feed_posts(created_at)")
cursor.execute("CREATE INDEX IF NOT EXISTS ix_feed_replies_post_id ON feed_replies(post_id)")
cursor.execute("CREATE INDEX IF NOT EXISTS ix_feed_likes_post_id_user_id ON feed_likes(post_id, user_id)")

conn.commit()
conn.close()

print("Feed tables created successfully.")
