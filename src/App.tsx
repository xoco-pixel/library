import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, Check, ChevronRight, CircleUserRound, Clock3, Compass, Home, Library, Menu, Moon, Search, Settings2, ShieldCheck, Sparkles, Star, Sun, X } from 'lucide-react'
import { books, categories, type Book } from './data'

type View = 'home' | 'library' | 'saved' | 'profile' | 'admin' | 'reader'

const stored = <T,>(key: string, fallback: T): [T, (value: T) => void] => {
  const [value, setValue] = useState<T>(() => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback } })
  const save = (next: T) => { setValue(next); localStorage.setItem(key, JSON.stringify(next)) }
  return [value, save]
}

function App() {
  const [view, setView] = useState<View>('home')
  const [menu, setMenu] = useState(false)
  const [selected, setSelected] = useState<Book | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [saved, setSaved] = stored<string[]>('gmsab-saved', [])
  const [progress, setProgress] = stored<Record<string, number>>('gmsab-progress', { focus: 72 })
  const [dark, setDark] = stored('gmsab-dark', false)

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])
  const filtered = useMemo(() => books.filter(b => (category === 'All' || b.category === category) && `${b.title} ${b.author} ${b.category}`.toLowerCase().includes(query.toLowerCase())), [query, category])
  const openBook = (book: Book) => { setSelected(book); setView('reader'); setMenu(false) }
  const toggleSaved = (id: string) => setSaved(saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id])

  return <div className="app">
    <header className="topbar">
      <button className="icon-button mobile-only" aria-label="Open menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
      <button className="brand" onClick={() => setView('home')}><span className="brand-mark">G</span><span>GM3SAB <b>Library</b></span></button>
      <nav className={menu ? 'nav open' : 'nav'}><button onClick={() => { setView('home'); setMenu(false) }}>Home</button><button onClick={() => { setView('library'); setMenu(false) }}>Library</button><button onClick={() => { setView('library'); setMenu(false) }}>Categories</button><button onClick={() => { setView('saved'); setMenu(false) }}>My Library</button></nav>
      <div className="top-actions"><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun /> : <Moon />}</button><button className="avatar" onClick={() => setView('profile')}><CircleUserRound /></button></div>
    </header>

    {view === 'reader' && selected ? <Reader book={selected} onBack={() => setView('library')} progress={progress[selected.id] || 0} setProgress={(n) => setProgress({ ...progress, [selected.id]: n })} dark={dark} /> : <>
      {view === 'home' && <HomeView onExplore={() => setView('library')} onOpen={openBook} saved={saved} toggleSaved={toggleSaved} />}
      {view === 'library' && <LibraryView books={filtered} query={query} setQuery={setQuery} category={category} setCategory={setCategory} onOpen={openBook} saved={saved} toggleSaved={toggleSaved} />}
      {view === 'saved' && <LibraryView books={books.filter(b => saved.includes(b.id))} query="" setQuery={() => {}} category="All" setCategory={() => {}} onOpen={openBook} saved={saved} toggleSaved={toggleSaved} savedOnly />}
      {view === 'profile' && <Profile saved={saved} progress={progress} onAdmin={() => setView('admin')} />}
      {view === 'admin' && <Admin onBack={() => setView('home')} />}
    </>}
    {view !== 'reader' && <footer className="bottom-nav"><button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}><Home /><span>Home</span></button><button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><Compass /><span>Explore</span></button><button className={view === 'saved' ? 'active' : ''} onClick={() => setView('saved')}><Library /><span>My Library</span></button><button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}><CircleUserRound /><span>Profile</span></button></footer>}
  </div>
}

function HomeView({ onExplore, onOpen, saved, toggleSaved }: { onExplore: () => void; onOpen: (b: Book) => void; saved: string[]; toggleSaved: (id: string) => void }) {
  return <main><section className="hero"><div className="eyebrow"><Sparkles size={15} /> CURATED FOR CURIOUS MINDS</div><h1>Read something<br /><em>worth your time.</em></h1><p>Discover books to learn, grow, imagine, and explore — all in one digital library.</p><button className="primary" onClick={onExplore}>Explore library <ArrowRight size={18} /></button><div className="hero-stats"><span><b>2.4k+</b> books</span><span><b>Free</b> forever</span><span><b>Read</b> anywhere</span></div></section><section className="section"><div className="section-heading"><div><span className="eyebrow">HANDPICKED FOR YOU</span><h2>Featured reads</h2></div><button className="text-button" onClick={onExplore}>View all <ChevronRight size={16} /></button></div><div className="featured-grid">{books.filter(b => b.featured).map(b => <BookCard key={b.id} book={b} onOpen={onOpen} saved={saved.includes(b.id)} toggleSaved={toggleSaved} featured />)}<BookCard book={books[1]} onOpen={onOpen} saved={saved.includes(books[1].id)} toggleSaved={toggleSaved} /></div></section><section className="section"><div className="section-heading"><div><span className="eyebrow">EXPLORE BY TOPIC</span><h2>Find your next idea</h2></div></div><div className="chips">{categories.slice(1).map(c => <button key={c} onClick={onExplore}>{c}</button>)}</div></section></main>
}

function LibraryView({ books: list, query, setQuery, category, setCategory, onOpen, saved, toggleSaved, savedOnly = false }: { books: Book[]; query: string; setQuery: (v: string) => void; category: string; setCategory: (v: string) => void; onOpen: (b: Book) => void; saved: string[]; toggleSaved: (id: string) => void; savedOnly?: boolean }) {
  return <main className="page"><div className="page-title"><span className="eyebrow">{savedOnly ? 'YOUR COLLECTION' : 'THE LIBRARY'}</span><h1>{savedOnly ? 'Saved books' : 'Find your next read.'}</h1><p>{savedOnly ? 'A quiet shelf for the stories and ideas you want to return to.' : 'Thoughtful books for every season of your life.'}</p></div>{!savedOnly && <><div className="search-box"><Search size={19} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search books, authors, topics..." /></div><div className="chips filter-chips">{categories.map(c => <button className={category === c ? 'selected' : ''} key={c} onClick={() => setCategory(c)}>{c}</button>)}</div></>}<div className="book-grid">{list.length ? list.map(b => <BookCard key={b.id} book={b} onOpen={onOpen} saved={saved.includes(b.id)} toggleSaved={toggleSaved} />) : <div className="empty"><BookOpen size={30} /><h3>Your shelf is empty</h3><p>Explore the library and save books you want to read later.</p></div>}</div></main>
}

function BookCard({ book, onOpen, saved, toggleSaved, featured = false }: { book: Book; onOpen: (b: Book) => void; saved: boolean; toggleSaved: (id: string) => void; featured?: boolean }) {
  return <article className={featured ? 'book-card featured-card' : 'book-card'}><button className="cover-button" onClick={() => onOpen(book)}><img src={book.cover} alt={`${book.title} cover`} /><span className="read-pill">Read now</span></button><div className="book-meta"><div className="meta-top"><span className="category-label">{book.category}</span><button className={saved ? 'save-button saved' : 'save-button'} onClick={() => toggleSaved(book.id)} aria-label="Save book">{saved ? <Check size={16} /> : <Bookmark size={16} />}</button></div><h3>{book.title}</h3><p>{book.author}</p><div className="book-details"><span><Clock3 size={14} /> {book.readTime}</span><span><BookOpen size={14} /> {book.pages} pages</span></div></div></article>
}

function Reader({ book, onBack, progress, setProgress, dark }: { book: Book; onBack: () => void; progress: number; setProgress: (n: number) => void; dark: boolean }) {
  const [chapter, setChapter] = useState(Math.min(Math.floor(progress / 34), book.chapters.length - 1)); const [size, setSize] = useState(18); const current = book.chapters[chapter]; const pct = Math.round(((chapter + 1) / book.chapters.length) * 100)
  const move = (delta: number) => { const next = Math.max(0, Math.min(book.chapters.length - 1, chapter + delta)); setChapter(next); setProgress(Math.max(progress, Math.round((next / book.chapters.length) * 100))) }
  return <div className="reader"><header className="reader-head"><button className="icon-button" onClick={onBack}><ArrowLeft /></button><div><small>NOW READING</small><strong>{book.title}</strong></div><button className="icon-button"><Settings2 /></button></header><div className="reader-progress"><span style={{ width: `${pct}%` }} /></div><main className="reader-body"><div className="reader-kicker">CHAPTER {chapter + 1} OF {book.chapters.length}</div><h1>{current.title}</h1><div className="reader-tools"><button onClick={() => setSize(Math.max(15, size - 1))}>A−</button><span>{size}px</span><button onClick={() => setSize(Math.min(26, size + 1))}>A+</button><span className="tool-divider" /><button onClick={() => setProgress(pct)}><Bookmark size={17} /></button></div><div className="reader-copy" style={{ fontSize: size }}><p>{current.content}</p></div><div className="reader-nav"><button disabled={chapter === 0} onClick={() => move(-1)}><ArrowLeft size={18} /> Previous</button><strong>{pct}% complete</strong><button disabled={chapter === book.chapters.length - 1} onClick={() => move(1)}>Next <ArrowRight size={18} /></button></div></main></div>
}

function Profile({ saved, progress, onAdmin }: { saved: string[]; progress: Record<string, number>; onAdmin: () => void }) { return <main className="page profile-page"><div className="profile-hero"><div className="large-avatar">JD</div><div><span className="eyebrow">YOUR PROFILE</span><h1>Jordan Davis</h1><p>Member since September 2024</p></div></div><div className="stats-row"><div><b>{saved.length}</b><span>Saved books</span></div><div><b>{Object.keys(progress).length}</b><span>Reading now</span></div><div><b>0</b><span>Completed</span></div></div><div className="settings-list"><button><CircleUserRound /> Account details <ChevronRight /></button><button><Bookmark /> My bookmarks <ChevronRight /></button><button><Settings2 /> Reading preferences <ChevronRight /></button><button className="admin-link" onClick={onAdmin}><ShieldCheck /> Owner Admin <ChevronRight /></button></div></main> }

function Admin({ onBack }: { onBack: () => void }) { const [notice, setNotice] = useState(''); return <main className="page admin-page"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to library</button><div className="page-title"><span className="eyebrow">OWNER SPACE</span><h1>Admin dashboard</h1><p>Manage your library content from anywhere.</p></div><div className="admin-stats"><div><BookOpen /><b>{books.length}</b><span>Total books</span></div><div><Check /><b>{books.length}</b><span>Published</span></div><div><CircleUserRound /><b>1</b><span>Members</span></div><div><Star /><b>0</b><span>Reviews</span></div></div><div className="admin-section"><div className="section-heading"><div><span className="eyebrow">CONTENT</span><h2>Books</h2></div><button className="primary small" onClick={() => setNotice('Book editor is ready for the API connection.')}>+ Add book</button></div>{notice && <div className="notice"><Check size={16} /> {notice}</div>}{books.map(book => <div className="admin-book" key={book.id}><img src={book.cover} alt="" /><div><b>{book.title}</b><span>{book.category} · Published</span></div><button className="icon-button"><ChevronRight /></button></div>)}</div></main> }

export default App
