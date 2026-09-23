const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const dbPath = path.join(__dirname, '../data/gmsab-library.db')
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      author TEXT NOT NULL,
      short_description TEXT,
      description TEXT,
      category_id INTEGER,
      cover_image TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      featured INTEGER NOT NULL DEFAULT 0,
      new_release INTEGER NOT NULL DEFAULT 0,
      is_free INTEGER NOT NULL DEFAULT 1,
      reading_time TEXT,
      page_count INTEGER,
      publication_date TEXT,
      keywords TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saved_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, book_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      review_text TEXT,
      status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, book_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reading_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      chapter_index INTEGER DEFAULT 0,
      percent INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, book_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      chapter_index INTEGER DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id INTEGER,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count
  if (!categoryCount) {
    const insertCategory = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)')
    ;[
      ['Education', 'education'],
      ['Money', 'money'],
      ['Business', 'business'],
      ['Self-Development', 'self-development'],
      ['Technology', 'technology'],
      ['Creativity', 'creativity'],
      ['Fiction', 'fiction'],
    ].forEach(([name, slug]) => insertCategory.run(name, slug))
  }

  const bookCount = db.prepare('SELECT COUNT(*) as count FROM books').get().count
  if (!bookCount) {
    const firstCategoryId = db.prepare('SELECT id FROM categories WHERE slug = ?').get('self-development')?.id || 1
    const insertBook = db.prepare(`
      INSERT INTO books (title, slug, author, short_description, description, category_id, cover_image, status, featured, new_release, is_free, reading_time, page_count, publication_date, keywords, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'published', 1, 1, 1, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)

    insertBook.run(
      'The Art of Deep Focus',
      'the-art-of-deep-focus',
      'Maya Ellison',
      'A practical guide to reclaiming focus and doing the work that matters.',
      'Your attention is valuable. Build rituals, remove friction, and protect the work that matters most.',
      firstCategoryId,
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=80',
      '18 min',
      82,
      '2024-09-03',
      'focus, attention, productivity, deep work',
    )

    const addedBookId = db.prepare('SELECT id FROM books WHERE slug = ?').get('the-art-of-deep-focus').id
    db.prepare(`INSERT INTO chapters (book_id, title, content, order_index) VALUES (?, ?, ?, 1)`).run(addedBookId, 'The Attention Economy', 'Your attention is one of your most valuable resources. Before you can focus, you need to understand what competes for it. Focus is not about forcing yourself to work harder. It is about designing an environment where the right work becomes the easiest work to begin.',)
    db.prepare(`INSERT INTO chapters (book_id, title, content, order_index) VALUES (?, ?, ?, 2)`).run(addedBookId, 'A Better Starting Ritual', 'A reliable ritual turns intention into action. Choose one small cue, remove one source of friction, and give yourself a clear first step. The goal is not a perfect morning. The goal is a repeated beginning.',)
  }
}

module.exports = { db, initDb }
