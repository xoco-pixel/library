const express = require('express')
const session = require('express-session')
const bcrypt = require('bcryptjs')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
require('dotenv').config()
const { db, initDb } = require('./db.cjs')

const app = express()
const port = Number(process.env.PORT || 4000)
const production = process.env.NODE_ENV === 'production'
const uploadDir = path.join(__dirname, '../uploads')
fs.mkdirSync(uploadDir, { recursive: true })
initDb()

app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false, limit: '1mb' }))
app.use(session({
  secret: process.env.SESSION_SECRET || (production ? (() => { throw new Error('SESSION_SECRET is required in production') })() : 'local-development-secret-change-me'),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: production, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 },
}))
app.use('/uploads', express.static(uploadDir, { maxAge: '1d', fallthrough: false }))
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false })
const writeLimit = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false })
app.use('/api/auth', authLimit)
app.use('/api', writeLimit)

const userDto = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status })
const slugify = s => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const idOf = value => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null
const audit = (req, action, type, id, details = {}) => db.prepare('INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,details) VALUES(?,?,?,?,?)').run(req.session.userId, action, type, id, JSON.stringify(details))
const requireAuth = (req,res,next) => { if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' }); const u = db.prepare('SELECT * FROM users WHERE id=? AND status=?').get(req.session.userId,'active'); if (!u) return res.status(401).json({ error: 'Session expired' }); req.user=u; next() }
const requireOwner = (req,res,next) => requireAuth(req,res,() => req.user.role === 'owner' ? next() : res.status(403).json({ error: 'Owner access required' }))
const publicBook = id => db.prepare(`SELECT b.*,c.name category_name FROM books b JOIN categories c ON c.id=b.category_id WHERE b.id=? AND b.status='published'`).get(id)
const fullBook = id => { const b = db.prepare('SELECT b.*,c.name category_name FROM books b JOIN categories c ON c.id=b.category_id WHERE b.id=?').get(id); if (!b) return null; b.chapters=db.prepare('SELECT id,title,content,order_index FROM chapters WHERE book_id=? ORDER BY order_index,id').all(id); return b }

app.get('/api/health', (_,res) => res.json({ ok:true }))
app.get('/api/me', (req,res) => { if (!req.session.userId) return res.json({user:null}); const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId); res.json({user:u ? userDto(u) : null}) })
app.post('/api/auth/signup', (req,res) => { const name=String(req.body?.name||'').trim(), email=String(req.body?.email||'').trim().toLowerCase(), password=String(req.body?.password||''); if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||password.length<10) return res.status(400).json({error:'Use a valid email and a password of at least 10 characters.'}); if(db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).json({error:'Account already exists.'}); const configured=(process.env.OWNER_EMAIL||'').trim().toLowerCase(); const ownerExists=db.prepare("SELECT id FROM users WHERE role='owner'").get(); const role=!ownerExists&&configured&&configured===email?'owner':'member'; const r=db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run(name,email,bcrypt.hashSync(password,12),role); req.session.userId=r.lastInsertRowid; const u=db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid); res.status(201).json({user:userDto(u)}) })
app.post('/api/auth/login', (req,res) => { const email=String(req.body?.email||'').trim().toLowerCase(), password=String(req.body?.password||''); const u=db.prepare('SELECT * FROM users WHERE email=?').get(email); if(!u||u.status!=='active'||!bcrypt.compareSync(password,u.password_hash)) return res.status(401).json({error:'Invalid credentials.'}); req.session.regenerate(err => { if(err) return res.status(500).json({error:'Unable to start session'}); req.session.userId=u.id; db.prepare('UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?').run(u.id); if(u.role==='owner') audit(req,'LOGIN','user',u.id); res.json({user:userDto(u)}) }) })
app.post('/api/auth/logout', requireAuth, (req,res) => req.session.destroy(() => res.json({ok:true})))
app.get('/api/categories', (_,res) => res.json({categories:db.prepare('SELECT id,name,slug FROM categories ORDER BY name').all()}))
app.get('/api/library', (req,res) => { const q=String(req.query.q||'').trim(); const cat=idOf(req.query.category); const books=db.prepare(`SELECT b.*,c.name category_name FROM books b JOIN categories c ON c.id=b.category_id WHERE b.status='published' AND (?='' OR b.title LIKE ? OR b.author LIKE ? OR b.keywords LIKE ?) AND (? IS NULL OR b.category_id=?) ORDER BY b.publication_date DESC,b.created_at DESC`).all(q,`%${q}%`,`%${q}%`,`%${q}%`,cat,cat); res.json({books:books.map(b=>({...b,featured:!!b.featured,new_release:!!b.new_release,is_free:!!b.is_free}))}) })
app.get('/api/books/:id', requirePublicBook, (req,res) => { const b=fullBook(req.params.id); db.prepare('INSERT INTO reading_events(user_id,book_id,event_type) VALUES(?,?,?)').run(req.session.userId||null,b.id,'BOOK_OPENED'); res.json({book:b}) })
function requirePublicBook(req,res,next){ const id=idOf(req.params.id); const b=id&&publicBook(id); if(!b) return res.status(404).json({error:'Book not found'}); req.publicBook=b; next() }

app.get('/api/saved-books', requireAuth, (req,res) => res.json({saved_books:db.prepare('SELECT book_id,created_at FROM saved_books WHERE user_id=? ORDER BY created_at DESC').all(req.user.id)}))
app.post('/api/saved-books', requireAuth, (req,res) => { const id=idOf(req.body?.book_id); if(!id||!publicBook(id)) return res.status(404).json({error:'Book not found'}); db.prepare('INSERT OR IGNORE INTO saved_books(user_id,book_id) VALUES(?,?)').run(req.user.id,id); res.status(201).json({ok:true}) })
app.delete('/api/saved-books/:id', requireAuth, (req,res) => { db.prepare('DELETE FROM saved_books WHERE user_id=? AND book_id=?').run(req.user.id,idOf(req.params.id)); res.json({ok:true}) })
app.get('/api/progress/:bookId', requireAuth, (req,res) => res.json({progress:db.prepare('SELECT * FROM reading_progress WHERE user_id=? AND book_id=?').get(req.user.id,idOf(req.params.bookId))||null}))
app.put('/api/progress/:bookId', requireAuth, (req,res) => { const bookId=idOf(req.params.bookId); if(!publicBook(bookId)) return res.status(404).json({error:'Book not found'}); const chapter=Math.max(0,Number(req.body?.chapter_index)||0), percent=Math.min(100,Math.max(0,Number(req.body?.percent)||0)); db.prepare(`INSERT INTO reading_progress(user_id,book_id,chapter_index,percent,completed) VALUES(?,?,?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET chapter_index=excluded.chapter_index,percent=excluded.percent,completed=excluded.completed,updated_at=CURRENT_TIMESTAMP`).run(req.user.id,bookId,chapter,percent,percent>=100); res.json({ok:true}) })
app.get('/api/bookmarks', requireAuth, (req,res) => res.json({bookmarks:db.prepare('SELECT * FROM bookmarks WHERE user_id=? ORDER BY created_at DESC').all(req.user.id)}))
app.post('/api/bookmarks', requireAuth, (req,res) => { const bookId=idOf(req.body?.book_id); if(!publicBook(bookId)) return res.status(404).json({error:'Book not found'}); const r=db.prepare('INSERT INTO bookmarks(user_id,book_id,chapter_index,note) VALUES(?,?,?,?)').run(req.user.id,bookId,Number(req.body?.chapter_index)||0,String(req.body?.note||'').slice(0,500)); res.status(201).json({id:r.lastInsertRowid}) })
app.delete('/api/bookmarks/:id', requireAuth, (req,res) => { db.prepare('DELETE FROM bookmarks WHERE id=? AND user_id=?').run(idOf(req.params.id),req.user.id); res.json({ok:true}) })
app.post('/api/books/:id/reviews', requireAuth, (req,res) => { const bookId=idOf(req.params.id), rating=Number(req.body?.rating), text=String(req.body?.review_text||'').trim(); if(!publicBook(bookId)||rating<1||rating>5||!text||text.length>5000) return res.status(400).json({error:'Valid book, rating and review text are required.'}); try { db.prepare('INSERT INTO reviews(user_id,book_id,rating,review_text) VALUES(?,?,?,?)').run(req.user.id,bookId,rating,text); res.status(201).json({ok:true}) } catch { res.status(409).json({error:'You already reviewed this book.'}) } })
app.post('/api/books/:id/comments', requireAuth, (req,res) => { const bookId=idOf(req.params.id), body=String(req.body?.body||'').trim(); if(!publicBook(bookId)||!body||body.length>2000) return res.status(400).json({error:'A valid comment is required.'}); const r=db.prepare('INSERT INTO comments(user_id,book_id,body) VALUES(?,?,?)').run(req.user.id,bookId,body); res.status(201).json({id:r.lastInsertRowid}) })

const upload=multer({dest:uploadDir,limits:{fileSize:2*1024*1024},fileFilter:(_,f,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(f.mimetype))})
app.post('/api/admin/upload-cover', requireOwner, upload.single('cover'), (req,res) => { if(!req.file) return res.status(400).json({error:'JPEG, PNG, or WebP image required.'}); const ext=req.mimetype==='image/png'?'.png':req.mimetype==='image/webp'?'.webp':'.jpg'; const safe=crypto.randomUUID()+ext; fs.renameSync(req.file.path,path.join(uploadDir,safe)); res.status(201).json({url:'/uploads/'+safe}) })
app.get('/api/admin/books', requireOwner, (_,res) => res.json({books:db.prepare('SELECT b.*,c.name category_name FROM books b JOIN categories c ON c.id=b.category_id ORDER BY b.updated_at DESC').all()}))
app.post('/api/admin/books', requireOwner, (req,res) => { const x=req.body||{}, title=String(x.title||'').trim(), author=String(x.author||'').trim(), description=String(x.description||'').trim(), category=idOf(x.category_id); if(!title||!author||!description||!category||!db.prepare('SELECT id FROM categories WHERE id=?').get(category)) return res.status(400).json({error:'Title, author, description and a valid category are required.'}); const base=slugify(title)||'book', slug=db.prepare('SELECT id FROM books WHERE slug=?').get(base)?`${base}-${Date.now()}`:base; const r=db.prepare(`INSERT INTO books(title,slug,author,short_description,description,category_id,cover_image,status,featured,new_release,is_free,reading_time,page_count,publication_date,keywords) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(title,slug,author,String(x.short_description||description).slice(0,300),description,category,String(x.cover_image||''),'draft',x.featured?1:0,x.new_release?1:0,1,String(x.reading_time||'10 min'),Math.max(1,Number(x.page_count)||1),x.publication_date||null,String(x.keywords||'')); audit(req,'BOOK_CREATED','book',r.lastInsertRowid,{title}); res.status(201).json({book:fullBook(r.lastInsertRowid)}) })
app.post('/api/admin/books/:id/chapters', requireOwner, (req,res) => { const bookId=idOf(req.params.id), title=String(req.body?.title||'').trim(), content=String(req.body?.content||'').trim(); if(!bookId||!title||!content||!db.prepare('SELECT id FROM books WHERE id=?').get(bookId)) return res.status(400).json({error:'Valid book, chapter title and content required.'}); const order=Number(req.body?.order_index)||((db.prepare('SELECT MAX(order_index) n FROM chapters WHERE book_id=?').get(bookId).n||0)+1); const r=db.prepare('INSERT INTO chapters(book_id,title,content,order_index) VALUES(?,?,?,?)').run(bookId,title,content,order); audit(req,'CHAPTER_CREATED','chapter',r.lastInsertRowid,{bookId}); res.status(201).json({chapter:{id:r.lastInsertRowid}}) })
app.put('/api/admin/chapters/:id', requireOwner, (req,res) => { const id=idOf(req.params.id); const c=db.prepare('SELECT * FROM chapters WHERE id=?').get(id); if(!c) return res.status(404).json({error:'Chapter not found'}); db.prepare('UPDATE chapters SET title=?,content=?,order_index=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(String(req.body?.title||c.title),String(req.body?.content||c.content),Number(req.body?.order_index)||c.order_index,id); audit(req,'CHAPTER_UPDATED','chapter',id); res.json({ok:true}) })
app.delete('/api/admin/chapters/:id', requireOwner, (req,res) => { const id=idOf(req.params.id); if(!db.prepare('SELECT id FROM chapters WHERE id=?').get(id)) return res.status(404).json({error:'Chapter not found'}); db.prepare('DELETE FROM chapters WHERE id=?').run(id); audit(req,'CHAPTER_DELETED','chapter',id); res.json({ok:true}) })
app.post('/api/admin/books/:id/publish', requireOwner, (req,res) => { const id=idOf(req.params.id), b=db.prepare('SELECT * FROM books WHERE id=?').get(id), chapters=db.prepare('SELECT id FROM chapters WHERE book_id=?').all(id); if(!b) return res.status(404).json({error:'Book not found'}); if(!b.title||!b.author||!b.description||!b.category_id||!chapters.length) return res.status(422).json({error:'Required metadata and at least one chapter are required before publishing.'}); db.prepare("UPDATE books SET status='published',published_at=COALESCE(published_at,CURRENT_TIMESTAMP),publication_date=COALESCE(publication_date,DATE('now')),updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id); audit(req,'BOOK_PUBLISHED','book',id); res.json({ok:true}) })
app.post('/api/admin/books/:id/unpublish', requireOwner, (req,res) => { const id=idOf(req.params.id); if(!db.prepare('SELECT id FROM books WHERE id=?').get(id)) return res.status(404).json({error:'Book not found'}); db.prepare("UPDATE books SET status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id); audit(req,'BOOK_UNPUBLISHED','book',id); res.json({ok:true}) })
app.delete('/api/admin/books/:id', requireOwner, (req,res) => { const id=idOf(req.params.id), b=db.prepare('SELECT * FROM books WHERE id=?').get(id); if(!b) return res.status(404).json({error:'Book not found'}); db.prepare('DELETE FROM books WHERE id=?').run(id); audit(req,'BOOK_DELETED','book',id,{title:b.title}); res.json({ok:true}) })
app.get('/api/admin/overview', requireOwner, (_,res) => { const count=q=>db.prepare(q).get().n; res.json({totalBooks:count('SELECT COUNT(*) n FROM books'),publishedBooks:count("SELECT COUNT(*) n FROM books WHERE status='published'"),draftBooks:count("SELECT COUNT(*) n FROM books WHERE status='draft'"),totalMembers:count("SELECT COUNT(*) n FROM users WHERE role='member'"),totalReads:count("SELECT COUNT(*) n FROM reading_events"),totalReviews:count('SELECT COUNT(*) n FROM reviews'),totalComments:count('SELECT COUNT(*) n FROM comments')}) })
app.get('/api/admin/audit-log', requireOwner, (_,res) => res.json({entries:db.prepare('SELECT a.*,u.name actor_name FROM audit_logs a JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 200').all()}))

app.use((err,_,res,__) => { console.error(err); res.status(500).json({error:'Internal server error'}) })
if (process.env.NODE_ENV==='production') { const dist=path.join(__dirname,'../dist'); if(fs.existsSync(dist)){ app.use(express.static(dist)); app.get('*',(_,res)=>res.sendFile(path.join(dist,'index.html'))) } }
app.listen(port,()=>console.log(`GM3SAB API listening on ${port}`))
