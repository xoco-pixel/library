const express = require('express')
const session = require('express-session')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { initDb, db } = require('./db')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 4000
const uploadPath = path.join(__dirname, '../uploads')
fs.mkdirSync(uploadPath, { recursive: true })

initDb()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static(uploadPath))
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}))

const upload = multer({
  dest: uploadPath,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = file.mimetype?.startsWith('image/')
    cb(allowed ? null : new Error('Only image files are allowed'), Boolean(allowed))
  },
})

const sanitizeUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role })
const slugify = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

const requireOwner = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' })
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId)
  if (user?.role !== 'owner') return res.status(403).json({ error: 'Owner access required' })
  next()
}

function seedOwnerIfNeeded() {
  const ownerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase()
  if (!ownerEmail) return
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(ownerEmail)
  if (!exists) {
    const firstUser = db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get()
    if (!firstUser) return
    db.prepare('UPDATE users SET role = ? WHERE email = ?').run('owner', ownerEmail)
  }
}

app.get('/api/health', (_, res) => res.json({ ok: true }))

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null })
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.session.userId)
  if (!user) return res.json({ user: null })
  return res.json({ user: sanitizeUser(user) })
})

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body || {}
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' })

  const normEmail = String(email).trim().toLowerCase()
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normEmail)
  if (existing) return res.status(409).json({ error: 'Account already exists.' })

  const passwordHash = bcrypt.hashSync(String(password), 10)
  const ownerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase()
  const firstUserExists = db.prepare('SELECT id FROM users LIMIT 1').get()
  const role = ownerEmail && normEmail === ownerEmail ? 'owner' : firstUserExists ? 'member' : 'owner'

  const stmt = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
  const info = stmt.run(String(name).trim(), normEmail, passwordHash, role)
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(info.lastInsertRowid)
  req.session.userId = user.id
  res.json({ user: sanitizeUser(user) })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' })
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase())
  if (!user) return res.status(401).json({ error: 'Invalid credentials.' })
  const valid = bcrypt.compareSync(String(password), user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials.' })
  req.session.userId = user.id
  res.json({ user: sanitizeUser(user) })
})

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true })
  })
})

app.get('/api/categories', (_, res) => {
  const categories = db.prepare('SELECT id, name, slug FROM categories ORDER BY id ASC').all()
  res.json({ categories })
})

app.get('/api/library', (_, res) => {
  const books = db.prepare(`
    SELECT b.*, c.name AS category_name
    FROM books b
    LEFT JOIN categories c ON c.id = b.category_id
    WHERE b.status = 'published'
    ORDER BY b.created_at DESC
  `).all()
  res.json({ books: books.map(book => ({
    ...book,
    featured: Boolean(book.featured),
    new_release: Boolean(book.new_release),
    is_free: Boolean(book.is_free),
  })) })
})

app.get('/api/books/:id', (req, res) => {
  const book = db.prepare(`
    SELECT b.*, c.name AS category_name
    FROM books b
    LEFT JOIN categories c ON c.id = b.category_id
    WHERE b.id = ?
  `).get(Number(req.params.id))
  if (!book) return res.status(404).json({ error: 'Book not found' })
  const chapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY order_index ASC').all(book.id)
  const reviews = db.prepare('SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.book_id = ? AND r.status = "approved" ORDER BY r.created_at DESC').all(book.id)
  const comments = db.prepare('SELECT c.*, u.name AS user_name FROM comments c JOIN users u ON u.id = c.user_id WHERE c.book_id = ? AND c.status = "approved" ORDER BY c.created_at DESC').all(book.id)
  res.json({ book: { ...book, chapters, reviews, comments } })
})

app.post('/api/upload-cover', requireOwner, upload.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' })
  const url = `/uploads/${req.file.filename}`
  res.json({ url })
})

app.post('/api/books', requireOwner, (req, res) => {
  const body = req.body || {}
  const title = String(body.title || '').trim()
  const author = String(body.author || '').trim()
  const description = String(body.description || '').trim()
  if (!title || !author || !description) {
    return res.status(400).json({ error: 'Title, author and description are required.' })
  }
  const categoryId = Number(body.category_id || 1)
  const slug = slugify(title) || 'book'
  const shortDescription = String(body.short_description || description).slice(0, 200)
  const coverImage = body.cover_image || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80'
  const publicationDate = body.publication_date || new Date().toISOString().slice(0, 10)
  const pageCount = Number(body.page_count || 1)
  const readingTime = String(body.reading_time || '10 min')
  const keywords = String(body.keywords || '')
  const status = String(body.status || 'draft')
  const isFree = body.is_free !== false
  const featured = Boolean(body.featured)
  const newRelease = Boolean(body.new_release)

  const exists = db.prepare('SELECT id FROM books WHERE slug = ?').get(slug)
  const finalSlug = exists ? `${slug}-${Date.now()}` : slug

  const record = db.prepare(`
    INSERT INTO books (
      title, slug, author, short_description, description, category_id, cover_image,
      status, featured, new_release, is_free, reading_time, page_count, publication_date,
      keywords, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `)
  const result = record.run(
    title,
    finalSlug,
    author,
    shortDescription,
    description,
    categoryId,
    coverImage,
    status,
    featured ? 1 : 0,
    newRelease ? 1 : 0,
    isFree ? 1 : 0,
    readingTime,
    pageCount,
    publicationDate,
    keywords,
  )

  const bookId = result.lastInsertRowid
  const content = body.content || description
  db.prepare('INSERT INTO chapters (book_id, title, content, order_index) VALUES (?, ?, ?, 1)').run(bookId, 'Introduction', content)

  db.prepare('INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(req.session.userId, 'BOOK_CREATED', 'book', bookId, JSON.stringify({ title, status }))

  const created = db.prepare(`SELECT b.*, c.name as category_name FROM books b LEFT JOIN categories c ON c.id = b.category_id WHERE b.id = ?`).get(bookId)
  res.status(201).json({ book: created })
})

app.put('/api/books/:id', requireOwner, (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT id FROM books WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Book not found' })
  const update = db.prepare(`
    UPDATE books
    SET title = ?, author = ?, short_description = ?, description = ?, category_id = ?, cover_image = ?,
        status = ?, featured = ?, new_release = ?, is_free = ?, reading_time = ?, page_count = ?, publication_date = ?, keywords = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  update.run(
    String(req.body.title || '').trim(),
    String(req.body.author || '').trim(),
    String(req.body.short_description || '').trim(),
    String(req.body.description || '').trim(),
    Number(req.body.category_id || 1),
    req.body.cover_image || '',
    String(req.body.status || 'draft'),
    req.body.featured ? 1 : 0,
    req.body.new_release ? 1 : 0,
    req.body.is_free === false ? 0 : 1,
    String(req.body.reading_time || '10 min'),
    Number(req.body.page_count || 1),
    req.body.publication_date || new Date().toISOString().slice(0, 10),
    String(req.body.keywords || ''),
    id,
  )
  db.prepare('INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(req.session.userId, 'BOOK_UPDATED', 'book', id, JSON.stringify(req.body))
  res.json({ ok: true })
})

app.post('/api/books/:id/publish', requireOwner, (req,res) => {
  const id = Number(req.params.id)
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id)
  if (!book) return res.status(404).json({ error: 'Book not found' })
  db.prepare('UPDATE books SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('published', id)
  db.prepare('INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)').run(req.session.userId, 'BOOK_PUBLISHED', 'book', id, JSON.stringify({ status: 'published'}))
  res.json({ ok: true })
})

app.post('/api/books/:id/unpublish', requireOwner, (req,res) => {
  const id = Number(req.params.id)
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id)
  if (!book) return res.status(404).json({ error: 'Book not found' })
  db.prepare('UPDATE books SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('draft', id)
  db.prepare('INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)').run(req.session.userId, 'BOOK_UNPUBLISHED', 'book', id, JSON.stringify({ status: 'draft'}))
  res.json({ ok: true })
})

app.delete('/api/books/:id', requireOwner, (req,res) => {
  const id = Number(req.params.id)
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id)
  if (!book) return res.status(404).json({ error: 'Book not found' })
  db.prepare('DELETE FROM books WHERE id = ?').run(id)
  db.prepare('INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)').run(req.session.userId, 'BOOK_DELETED', 'book', id, JSON.stringify({ title: book.title }))
  res.json({ ok: true })
})

app.get('/api/saved-books', requireAuth, (_, res) => {
  const rows = db.prepare('SELECT * FROM saved_books WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId)
  res.json({ saved_books: rows })
})

app.post('/api/saved-books', requireAuth, (req,res) => {
  const bookId = Number(req.body.book_id)
  const existing = db.prepare('SELECT id FROM saved_books WHERE user_id = ? AND book_id = ?').get(req.session.userId, bookId)
  if (existing) return res.status(200).json({ ok: true })
  db.prepare('INSERT INTO saved_books (user_id, book_id) VALUES (?, ?)').run(req.session.userId, bookId)
  res.status(201).json({ ok: true })
})

app.delete('/api/saved-books/:bookId', requireAuth, (req,res) => {
  const bookId = Number(req.params.bookId)
  db.prepare('DELETE FROM saved_books WHERE user_id = ? AND book_id = ?').run(req.session.userId, bookId)
  res.json({ ok: true })
})

app.get('/api/admin/overview', requireOwner, (_, res) => {
  const totalBooks = db.prepare('SELECT COUNT(*) as total FROM books').get().total
  const publishedBooks = db.prepare("SELECT COUNT(*) as total FROM books WHERE status = 'published'").get().total
  const totalUsers = db.prepare('SELECT COUNT(*) as total FROM users').get().total
  const totalReviews = db.prepare('SELECT COUNT(*) as total FROM reviews').get().total
  res.json({ totalBooks, publishedBooks, totalUsers, totalReviews })
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist')
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath))
    app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')))
  }
}

app.listen(PORT, () => {
  console.log(`GM3SAB API running on http://localhost:${PORT}`)
})
