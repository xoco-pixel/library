import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Bookmark, BookOpen, Check, ChevronRight, CircleUserRound,
  Clock3, Compass, Home, Library, Menu, Moon, Search, Settings2, ShieldCheck,
  Sparkles, Star, Sun, X,
} from 'lucide-react'
import type { CSSProperties } from 'react'

type User = { id: number; name: string; email: string; role: 'member' | 'owner' }
type Category = { id: number; name: string; slug: string }
type Book = {
  id: number
  title: string
  author: string
  short_description: string
  description: string
  cover_image?: string
  category_id: number
  category_name: string
  status: 'draft' | 'published' | 'archived'
  featured: boolean
  new_release: boolean
  is_free: boolean
  reading_time: string
  page_count: number
  publication_date: string
  keywords: string
  chapters: Array<{ id: number; title: string; content: string; order_index: number }>
  saved?: boolean
}

type View = 'home' | 'library' | 'saved' | 'profile' | 'admin' | 'reader'

const apiFetch = async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
  const res = await fetch(url, { credentials: 'include', ...options, headers: { ...(options.headers || {}), 'Content-Type': 'application/json' } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Request failed')
  }
  return res.json() as Promise<T>
}

function App() {
  const [view, setView] = useState<View>('home')
  const [user, setUser] = useState<User | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [savedIds, setSavedIds] = useState<number[]>([])
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [loginForm, setLoginForm] = useState({ email: 'owner@example.com', password: 'admin123' })
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      const [meRes, libraryRes, catsRes] = await Promise.all([
        fetch('/api/me', { credentials: 'include' }).then(r => r.ok ? r.json() : { user: null }).catch(() => ({ user: null })),
        fetch('/api/library', { credentials: 'include' }).then(r => r.ok ? r.json() : { books: [] }).catch(() => ({ books: [] })),
        fetch('/api/categories', { credentials: 'include' }).then(r => r.ok ? r.json() : { categories: [] }).catch(() => ({ categories: [] })),
      ])
      setUser(meRes.user || null)
      setBooks(libraryRes.books || [])
      setCategories(catsRes.categories || [])
      if (meRes.user) {
        const savedRes = await fetch('/api/saved-books', { credentials: 'include' })
        if (savedRes.ok) {
          const body = await savedRes.json()
          setSavedIds((body.saved_books || []).map((x: { book_id: number }) => x.book_id))
        }
      }
    } catch {
      setError('Could not load the library right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const darkPref = localStorage.getItem('gmsab-theme') === 'dark'
    setDark(darkPref)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('gmsab-theme', dark ? 'dark' : 'light')
  }, [dark])

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesCat = category === 'all' || String(book.category_id) === category
      const haystack = `${book.title} ${book.author} ${book.category_name} ${book.keywords}`.toLowerCase()
      const matchesSearch = !query || haystack.includes(query.toLowerCase())
      return matchesCat && matchesSearch
    })
  }, [books, category, query])

  const toggleSaved = async (bookId: number) => {
    if (!user) {
      setError('Please log in to save books.')
      return
    }
    const exists = savedIds.includes(bookId)
    try {
      if (exists) {
        await fetch(`/api/saved-books/${bookId}`, { method: 'DELETE', credentials: 'include' })
        setSavedIds((prev) => prev.filter((id) => id !== bookId))
      } else {
        await fetch('/api/saved-books', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book_id: bookId }),
        })
        setSavedIds((prev) => [...prev, bookId])
      }
    } catch {
      setError('Unable to update saved books right now.')
    }
  }

  const openBook = async (book: Book) => {
    setSelectedBook(book)
    setView('reader')
    try {
      const res = await fetch(`/api/books/${book.id}`, { credentials: 'include' })
      if (res.ok) {
        const body = await res.json()
        setSelectedBook(body.book)
      }
    } catch {
      // keep existing selection if API fails
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const payload = authMode === 'login' ? loginForm : signupForm
    const route = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup'
    try {
      const res = await fetch(route, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Authentication failed')
      setUser(json.user)
      setView('home')
      setAuthMode('login')
      setError('')
      await loadData()
      setLoginForm({ email: 'owner@example.com', password: 'admin123' })
      setSignupForm({ name: '', email: '', password: '' })
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    setSavedIds([])
    setView('home')
  }

  const libraryBooks = filteredBooks
  const savedBooks = books.filter((book) => savedIds.includes(book.id))

  if (loading) return <div className="loading-shell">Loading GM3SAB Library…</div>

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-only icon-button" aria-label="Toggle menu" onClick={() => setMenuOpen((s) => !s)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <button className="brand" onClick={() => setView('home')}>
          <span className="brand-mark">G</span>
          <span>GM3SAB <b>Library</b></span>
        </button>

        <nav className={menuOpen ? 'nav open' : 'nav'}>
          <button onClick={() => { setView('home'); setMenuOpen(false) }}>Home</button>
          <button onClick={() => { setView('library'); setMenuOpen(false) }}>Library</button>
          <button onClick={() => { setView('saved'); setMenuOpen(false) }}>My Library</button>
          {user?.role === 'owner' && <button onClick={() => { setView('admin'); setMenuOpen(false) }}>Admin</button>}
        </nav>

        <div className="top-actions">
          <button className="icon-button" onClick={() => setDark((d) => !d)} aria-label="Toggle theme">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <button className="profile-button" onClick={() => setView('profile')}>
              <CircleUserRound size={18} /> {user.name.split(' ')[0]}
            </button>
          ) : (
            <button className="primary small" onClick={() => setView('profile')}>Log in</button>
          )}
        </div>
      </header>

      {error && <div className="global-alert">{error}</div>}

      {view === 'home' && (
        <main>
          <section className="hero">
            <div className="eyebrow"><Sparkles size={15} /> CURATED FOR CURIOUS MINDS</div>
            <h1>Read something<br /><em>worth your time.</em></h1>
            <p>Discover books to learn, grow, imagine, and explore — all in one digital library.</p>
            <div className="cta-row">
              <button className="primary" onClick={() => setView('library')}>Explore Library <ArrowRight size={18} /></button>
              {!user && <button className="secondary" onClick={() => setView('profile')}>Create free account</button>}
            </div>
            <div className="hero-stats">
              <div><strong>2.4k+</strong><span>books</span></div>
              <div><strong>Free</strong><span>forever</span></div>
              <div><strong>Read</strong><span>anywhere</span></div>
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">HANDPICKED FOR YOU</div>
                <h2>Featured reads</h2>
              </div>
              <button className="text-button" onClick={() => setView('library')}>View all <ChevronRight size={16} /></button>
            </div>
            <div className="feature-grid">
              {books.filter((book) => book.featured).slice(0, 3).map((book) => (
                <BookCard key={book.id} book={book} onOpen={openBook} saved={savedIds.includes(book.id)} toggleSaved={toggleSaved} featured />
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">EXPLORE</div>
                <h2>Browse topics</h2>
              </div>
            </div>
            <div className="chips">
              {categories.map((cat) => (
                <button key={cat.id} className="chip" onClick={() => { setCategory(String(cat.id)); setView('library') }}>{cat.name}</button>
              ))}
            </div>
          </section>
        </main>
      )}

      {view === 'library' && (
        <main className="page-shell">
          <div className="page-header">
            <div className="eyebrow">THE LIBRARY</div>
            <h1>Find your next read.</h1>
          </div>
          <div className="search-box">
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search books, authors, topics..." />
          </div>
          <div className="chips filter-cards">
            <button className={category === 'all' ? 'chip selected' : 'chip'} onClick={() => setCategory('all')}>All</button>
            {categories.map((cat) => (
              <button key={cat.id} className={String(cat.id) === category ? 'chip selected' : 'chip'} onClick={() => setCategory(String(cat.id))}>{cat.name}</button>
            ))}
          </div>

          <div className="book-grid">
            {libraryBooks.length ? libraryBooks.map((book) => (
              <BookCard key={book.id} book={book} onOpen={openBook} saved={savedIds.includes(book.id)} toggleSaved={toggleSaved} />
            )) : (
              <div className="empty-state">
                <BookOpen size={28} />
                <h3>No books found</h3>
                <p>Try a different keyword or category.</p>
              </div>
            )}
          </div>
        </main>
      )}

      {view === 'saved' && (
        <main className="page-shell">
          <div className="page-header">
            <div className="eyebrow">YOUR COLLECTION</div>
            <h1>Saved books</h1>
          </div>
          <div className="book-grid">
            {savedBooks.length ? savedBooks.map((book) => (
              <BookCard key={book.id} book={book} onOpen={openBook} saved={savedIds.includes(book.id)} toggleSaved={toggleSaved} />
            )) : (
              <div className="empty-state">
                <Library size={28} />
                <h3>Your library is empty</h3>
                <p>Explore the library and save books you want to read later.</p>
              </div>
            )}
          </div>
        </main>
      )}

      {view === 'profile' && (
        <main className="page-shell profile-shell">
          {user ? (
            <>
              <div className="profile-hero">
                <div className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div className="eyebrow">YOUR PROFILE</div>
                  <h1>{user.name}</h1>
                  <p>{user.email}</p>
                </div>
              </div>
              <div className="stats-row">
                <div><strong>{savedIds.length}</strong><span>Saved</span></div>
                <div><strong>{books.length}</strong><span>Library</span></div>
                <div><strong>{user.role === 'owner' ? 'OWNER' : 'MEMBER'}</strong><span>Role</span></div>
              </div>
              <div className="settings-list">
                <button><CircleUserRound size={18} /> Account details <ChevronRight size={16} /></button>
                <button><Bookmark size={18} /> Saved books <ChevronRight size={16} /></button>
                <button><Settings2 size={18} /> Reading preferences <ChevronRight size={16} /></button>
                {user.role === 'owner' && (
                  <button className="admin-link" onClick={() => setView('admin')}><ShieldCheck size={18} /> Owner admin <ChevronRight size={16} /></button>
                )}
                <button className="danger-button" onClick={handleLogout}><X size={18} /> Log out</button>
              </div>
            </>
          ) : (
            <div className="auth-card">
              <div className="eyebrow">WELCOME</div>
              <h1>Access your library</h1>
              <div className="segmented-control">
                <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Log in</button>
                <button className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>Sign up</button>
              </div>
              <form onSubmit={handleAuth} className="auth-form">
                {authMode === 'signup' && (
                  <label>
                    Name
                    <input value={signupForm.name} onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })} />
                  </label>
                )}
                <label>
                  Email
                  <input type="email" value={authMode === 'login' ? loginForm.email : signupForm.email} onChange={(e) => authMode === 'login' ? setLoginForm({ ...loginForm, email: e.target.value }) : setSignupForm({ ...signupForm, email: e.target.value })} />
                </label>
                <label>
                  Password
                  <input type="password" value={authMode === 'login' ? loginForm.password : signupForm.password} onChange={(e) => authMode === 'login' ? setLoginForm({ ...loginForm, password: e.target.value }) : setSignupForm({ ...signupForm, password: e.target.value })} />
                </label>
                <button className="primary submit-button" type="submit">{authMode === 'login' ? 'Log in' : 'Create account'}</button>
              </form>
            </div>
          )}
        </main>
      )}

      {view === 'admin' && user?.role === 'owner' && (
        <AdminPanel books={books} categories={categories} refresh={loadData} onBack={() => setView('home')} />
      )}

      {view === 'reader' && selectedBook && (
        <ReaderView book={selectedBook} onBack={() => setView('library')} saved={savedIds.includes(selectedBook.id)} toggleSaved={toggleSaved} />
      )}

      {view !== 'reader' && (
        <footer className="bottom-nav">
          <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}><Home size={18} /><span>Home</span></button>
          <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><Compass size={18} /><span>Explore</span></button>
          <button className={view === 'saved' ? 'active' : ''} onClick={() => setView('saved')}><Library size={18} /><span>Saved</span></button>
          <button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}><CircleUserRound size={18} /><span>Profile</span></button>
        </footer>
      )}
    </div>
  )
}

function BookCard({ book, onOpen, saved, toggleSaved, featured = false }: { book: Book; onOpen: (book: Book) => void; saved: boolean; toggleSaved: (id: number) => void; featured?: boolean }) {
  return (
    <article className={featured ? 'book-card large' : 'book-card'}>
      <button className="cover-button" onClick={() => onOpen(book)}>
        <img src={book.cover_image || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80'} alt={book.title} />
        <span className="read-pill">Read</span>
      </button>
      <div className="book-body">
        <div className="book-head">
          <span className="mini-tag">{book.category_name}</span>
          <button className={saved ? 'save-button saved' : 'save-button'} onClick={() => toggleSaved(book.id)}>{saved ? <Check size={15} /> : <Bookmark size={15} />}</button>
        </div>
        <h3>{book.title}</h3>
        <p>{book.author}</p>
        <div className="meta-row">
          <span><Clock3 size={13} /> {book.reading_time}</span>
          <span><BookOpen size={13} /> {book.page_count} pages</span>
        </div>
      </div>
    </article>
  )
}

function ReaderView({ book, onBack, saved, toggleSaved }: { book: Book; onBack: () => void; saved: boolean; toggleSaved: (id: number) => void }) {
  const [chapterIndex, setChapterIndex] = useState(0)
  const [fontSize, setFontSize] = useState(18)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const chapters = book.chapters || []
  const current = chapters[chapterIndex] || { title: 'Introduction', content: book.description }

  useEffect(() => {
    document.documentElement.dataset.readerTheme = theme
  }, [theme])

  return (
    <div className="reader-shell">
      <header className="reader-header">
        <button className="icon-button" onClick={onBack}><ArrowLeft size={18} /></button>
        <div>
          <small>NOW READING</small>
          <strong>{book.title}</strong>
        </div>
        <button className="icon-button" onClick={() => toggleSaved(book.id)}>{saved ? <Check size={18} /> : <Bookmark size={18} />}</button>
      </header>

      <div className="reader-topbar">
        <div className="progress-bar"><span style={{ width: `${((chapterIndex + 1) / Math.max(chapters.length || 1, 1)) * 100}%` }} /></div>
        <div className="reader-controls">
          <button onClick={() => setFontSize((s) => Math.max(15, s - 1))}>A−</button>
          <span>{fontSize}px</span>
          <button onClick={() => setFontSize((s) => Math.min(26, s + 1))}>A+</button>
          <button onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>{theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}</button>
        </div>
      </div>

      <main className="reader-body">
        <div className="kicker">CHAPTER {chapterIndex + 1}</div>
        <h1>{current.title}</h1>
        <article className="reader-content" style={{ fontSize: `${fontSize}px` } as CSSProperties}>{current.content}</article>
        <div className="reader-nav">
          <button disabled={chapterIndex === 0} onClick={() => setChapterIndex((i) => Math.max(0, i - 1))}>Previous</button>
          <span>{Math.round(((chapterIndex + 1) / Math.max(chapters.length || 1, 1)) * 100)}% complete</span>
          <button disabled={chapterIndex >= chapters.length - 1} onClick={() => setChapterIndex((i) => Math.min(chapters.length - 1, i + 1))}>Next</button>
        </div>
      </main>
    </div>
  )
}

function AdminPanel({ books, categories, refresh, onBack }: { books: Book[]; categories: Category[]; refresh: () => Promise<void>; onBack: () => void }) {
  const [form, setForm] = useState({
    title: '', author: '', short_description: '', description: '', category_id: String(categories[0]?.id || 1),
    cover_image: '', keywords: '', reading_time: '12 min', page_count: '40', publication_date: '', is_free: true,
    featured: false, new_release: false, status: 'draft',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          category_id: Number(form.category_id),
          page_count: Number(form.page_count),
          featured: Boolean(form.featured),
          new_release: Boolean(form.new_release),
          is_free: form.is_free,
          status: form.status,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not create book')
      setForm({ title: '', author: '', short_description: '', description: '', category_id: String(categories[0]?.id || 1), cover_image: '', keywords: '', reading_time: '12 min', page_count: '40', publication_date: '', is_free: true, featured: false, new_release: false, status: 'draft' })
      await refresh()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (book: Book) => {
    const action = book.status === 'published' ? '/api/books/' + book.id + '/unpublish' : '/api/books/' + book.id + '/publish'
    const res = await fetch(action, { method: 'POST', credentials: 'include' })
    if (res.ok) await refresh()
  }

  const deleteBook = async (book: Book) => {
    if (!confirm(`Delete ${book.title}?`)) return
    const res = await fetch('/api/books/' + book.id, { method: 'DELETE', credentials: 'include' })
    if (res.ok) await refresh()
  }

  return (
    <main className="page-shell admin-shell">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to home</button>
      <div className="page-header">
        <div className="eyebrow">OWNER SPACE</div>
        <h1>Admin dashboard</h1>
      </div>

      <div className="admin-summary">
        <div><strong>{books.length}</strong><span>Total books</span></div>
        <div><strong>{books.filter((b) => b.status === 'published').length}</strong><span>Published</span></div>
        <div><strong>{categories.length}</strong><span>Categories</span></div>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>Create a book</h3>
        <div className="two-col">
          <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>Author<input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></label>
        </div>
        <div className="two-col">
          <label>Short description<input value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} /></label>
          <label>Reading time<input value={form.reading_time} onChange={(e) => setForm({ ...form, reading_time: e.target.value })} /></label>
        </div>
        <label>Full description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} /></label>
        <div className="two-col">
          <label>Category<select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>
          <label>Cover URL<input value={form.cover_image} onChange={(e) => setForm({ ...form, cover_image: e.target.value })} /></label>
        </div>
        <div className="two-col">
          <label>Keywords<input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} /></label>
          <label>Page count<input type="number" value={form.page_count} onChange={(e) => setForm({ ...form, page_count: e.target.value })} /></label>
        </div>
        <div className="two-col">
          <label>Publication date<input type="date" value={form.publication_date} onChange={(e) => setForm({ ...form, publication_date: e.target.value })} /></label>
          <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'draft' | 'published' | 'archived' })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
        </div>
        <div className="inline-checks">
          <label><input type="checkbox" checked={form.is_free} onChange={(e) => setForm({ ...form, is_free: e.target.checked })} /> Free</label>
          <label><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
          <label><input type="checkbox" checked={form.new_release} onChange={(e) => setForm({ ...form, new_release: e.target.checked })} /> New release</label>
        </div>
        <button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create book'}</button>
      </form>

      <div className="admin-list">
        {books.map((book) => (
          <div className="admin-book-item" key={book.id}>
            <img src={book.cover_image || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80'} alt={book.title} />
            <div className="admin-book-info">
              <strong>{book.title}</strong>
              <span>{book.author} · {book.status}</span>
            </div>
            <div className="admin-actions">
              <button onClick={() => togglePublish(book)}>{book.status === 'published' ? 'Unpublish' : 'Publish'}</button>
              <button className="danger" onClick={() => deleteBook(book)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

export default App
