const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const dataDir = path.join(__dirname, '../data')
fs.mkdirSync(dataDir, { recursive: true })
const db = new Database(path.join(dataDir, 'gmsab-library.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','owner','author','moderator')), status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_login_at TEXT);
    CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, author TEXT NOT NULL, short_description TEXT NOT NULL, description TEXT NOT NULL, category_id INTEGER NOT NULL, cover_image TEXT, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')), featured INTEGER NOT NULL DEFAULT 0, new_release INTEGER NOT NULL DEFAULT 0, is_free INTEGER NOT NULL DEFAULT 1, reading_time TEXT NOT NULL, page_count INTEGER NOT NULL DEFAULT 1, publication_date TEXT, published_at TEXT, keywords TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(category_id) REFERENCES categories(id));
    CREATE TABLE IF NOT EXISTS chapters (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, order_index INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS saved_books (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, book_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,book_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS reading_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, book_id INTEGER NOT NULL, chapter_index INTEGER NOT NULL DEFAULT 0, percent INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,book_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS bookmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, book_id INTEGER NOT NULL, chapter_index INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, book_id INTEGER NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), review_text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','hidden','rejected')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,book_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, book_id INTEGER NOT NULL, parent_id INTEGER, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','hidden','removed')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE, FOREIGN KEY(parent_id) REFERENCES comments(id) ON DELETE SET NULL);
    CREATE TABLE IF NOT EXISTS reading_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, book_id INTEGER NOT NULL, event_type TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id INTEGER NOT NULL, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id INTEGER, details TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(actor_user_id) REFERENCES users(id));
    CREATE INDEX IF NOT EXISTS idx_books_public ON books(status,featured,new_release,publication_date);
    CREATE INDEX IF NOT EXISTS idx_events_book ON reading_events(book_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `)
  const categories = [['Education','education'],['Money','money'],['Business','business'],['Self-Development','self-development'],['Technology','technology'],['Creativity','creativity'],['Fiction','fiction']]
  const insert = db.prepare('INSERT OR IGNORE INTO categories(name,slug) VALUES(?,?)')
  for (const row of categories) insert.run(...row)
}
module.exports = { db, initDb }
