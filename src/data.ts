export type Book = {
  id: string
  title: string
  author: string
  category: string
  description: string
  readTime: string
  pages: number
  cover: string
  featured?: boolean
  progress?: number
  chapters: { title: string; content: string }[]
}

export const categories = ['All', 'Education', 'Self-Development', 'Business', 'Technology', 'Fiction']

export const books: Book[] = [
  {
    id: 'focus', title: 'The Art of Deep Focus', author: 'Maya Ellison', category: 'Self-Development',
    description: 'A practical guide to reclaiming your attention and doing work that matters.', readTime: '18 min', pages: 86,
    cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=85', featured: true, progress: 72,
    chapters: [
      { title: 'The Attention Economy', content: 'Your attention is one of your most valuable resources. Before you can focus, you need to understand what competes for it.\n\nFocus is not about forcing yourself to work harder. It is about designing an environment where the right work becomes the easiest work to begin.' },
      { title: 'A Better Starting Ritual', content: 'A reliable ritual turns intention into action. Choose one small cue, remove one source of friction, and give yourself a clear first step.\n\nThe goal is not a perfect morning. The goal is a repeatable beginning.' },
      { title: 'Making Focus Sustainable', content: 'Deep work is a rhythm. Alternate periods of concentration with real recovery, protect your evenings, and measure progress by what you finish—not by how busy you felt.' },
    ],
  },
  {
    id: 'money', title: 'Simple Money, Better Life', author: 'Jon Bell', category: 'Money',
    description: 'Clear, calm financial principles for building a life with more freedom.', readTime: '24 min', pages: 112,
    cover: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=85',
    chapters: [{ title: 'The Calm Foundation', content: 'Good money decisions begin with clarity. Know what comes in, what goes out, and what you are building toward.' }],
  },
  {
    id: 'future', title: 'Letters From Tomorrow', author: 'Ari Monroe', category: 'Fiction',
    description: 'A quiet, hopeful story about memory, connection, and the roads we choose.', readTime: '31 min', pages: 148,
    cover: 'https://images.unsplash.com/photo-1511108690759-009324a90311?auto=format&fit=crop&w=600&q=85',
    chapters: [{ title: 'The First Letter', content: 'The letter arrived on a Tuesday, folded twice and addressed in a handwriting she did not recognize.' }],
  },
  {
    id: 'build', title: 'Build Small, Learn Fast', author: 'Nia Carter', category: 'Business',
    description: 'A field guide to turning useful ideas into products people want.', readTime: '15 min', pages: 64,
    cover: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=600&q=85',
    chapters: [{ title: 'Start With a Problem', content: 'The strongest products begin with a problem that is already expensive, frustrating, or frequent.' }],
  },
]
