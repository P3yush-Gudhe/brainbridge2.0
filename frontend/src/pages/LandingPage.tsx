import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain, Zap, BookOpen, BarChart3, Clock, Code2, FileText, Video,
  ScanLine, Map, Calculator, Trophy, ArrowRight,
  MessageSquare, ChevronDown, Bookmark, Sun, Moon
} from 'lucide-react'
import { useAppStore, resolveTheme } from '@/stores/appStore'

const featureGroups = [
  {
    title: 'Study Tools',
    desc: 'Understand complex concepts deeply',
    items: [
      { icon: MessageSquare, title: 'Chat', desc: 'Ask questions and solve problems with LaTeX and code support' },
      { icon: FileText, title: 'PDF Reader', desc: 'Upload documents to generate summaries, key points, and quizzes' },
      { icon: Video, title: 'YouTube Learning', desc: 'Paste video links for transcripts, notes, and study guides' },
      { icon: BookOpen, title: 'Study Notes', desc: 'Markdown note editor with tag management and exports' },
      { icon: ScanLine, title: 'OCR Scanner', desc: 'Extract readable text from textbook pages and images' },
      { icon: Map, title: 'Mind Maps', desc: 'Visual concept maps generated for any study topic' },
    ],
  },
  {
    title: 'Practice Modules',
    desc: 'Reinforce memory and test understanding',
    items: [
      { icon: Zap, title: 'Flashcards', desc: 'Decks with SM-2 spaced repetition scheduling' },
      { icon: Brain, title: 'Quiz Generator', desc: 'Customizable quizzes from your study material' },
      { icon: Code2, title: 'Code Playground', desc: 'Practice code in Python, C++, Java, and JavaScript' },
    ],
  },
  {
    title: 'Planning & Tracking',
    desc: 'Stay organized throughout the semester',
    items: [
      { icon: Clock, title: 'Focus Timer', desc: 'Pomodoro timer with ambient focus sounds' },
      { icon: BarChart3, title: 'Analytics', desc: 'Track study hours, daily habits, and subject breakdowns' },
      { icon: Calculator, title: 'CGPA Calculator', desc: 'Calculate SGPA, CGPA, and target requirements' },
      { icon: Trophy, title: 'Milestones', desc: 'Track consistency streaks and academic achievements' },
    ],
  },
]

const faqs = [
  { q: 'Is StudyMate free to use?', a: 'Yes, StudyMate includes a generous free tier for notes, study planner, focus timer, and core study features.' },
  { q: 'How does PDF and document analysis work?', a: 'Upload any standard PDF and StudyMate extracts key topics, structural summaries, and page-cited Q&A.' },
  { q: 'Can I access StudyMate on mobile devices?', a: 'Yes. The entire application is responsive with a mobile navigation bar across desktop, tablet, and phone screens.' },
  { q: 'Is my study data stored securely?', a: 'Yes. All notes, flashcard progress, and academic records are saved privately to your authenticated workspace.' },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="text-sm font-semibold text-text-primary group-hover:text-accent-text transition-colors pr-4">{q}</span>
        <ChevronDown className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <p className="text-xs text-text-secondary leading-relaxed pb-4 pr-8 animate-fade-in">{a}</p>
      )}
    </div>
  )
}

export function LandingPage() {
  const { theme, toggleTheme } = useAppStore()
  const effectiveTheme = resolveTheme(theme)

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* Header Bar */}
      <nav aria-label="Primary landing navigation" className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#5965B3] flex items-center justify-center text-white">
              <Bookmark className="w-4 h-4 fill-white/20" aria-hidden="true" />
            </div>
            <span className="font-semibold text-text-primary text-sm tracking-tight">StudyMate</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs font-medium text-text-secondary">
            <a href="#features" className="hover:text-text-primary transition-colors">Features</a>
            <a href="#faq" className="hover:text-text-primary transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={effectiveTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="btn btn-icon-sm btn-ghost text-text-secondary"
            >
              {effectiveTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link to="/login" className="btn btn-ghost text-xs">Sign in</Link>
            <Link to="/register" className="btn btn-primary text-xs">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 pb-20 px-6 relative overflow-hidden bg-surface border-b border-border">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-light border border-accent/25 text-accent-text text-xs font-medium">
            <span>A thoughtful study workspace for modern students</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-text-primary leading-tight">
            Study with focus. <br />
            <span className="text-accent-text">Organize your academic life.</span>
          </h1>

          <p className="text-sm sm:text-base text-text-secondary max-w-lg mx-auto leading-relaxed">
            One clean workspace for notes, flashcards, document reading, focus timing, and course planning.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link to="/register" className="btn btn-primary btn-lg">
              <span>Open Study Workspace</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link to="/login" className="btn btn-secondary btn-lg">
              <span>Sign In</span>
            </Link>
          </div>

          <div className="pt-8 flex flex-wrap justify-center gap-8 sm:gap-12 border-t border-border mt-8">
            {[
              { value: '50,000+', label: 'Students' },
              { value: '2M+', label: 'Hours studied' },
              { value: '98%', label: 'Satisfaction' },
              { value: '34%', label: 'Score boost' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-xl font-bold font-mono text-text-primary">{stat.value}</div>
                <div className="text-xs text-text-secondary">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 px-6">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight mb-1">
              Everything in one workspace
            </h2>
            <p className="text-xs text-text-secondary">
              Built to support every stage of your study routine.
            </p>
          </div>

          <div className="space-y-10">
            {featureGroups.map((group) => (
              <div key={group.title}>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-text-primary">{group.title}</h3>
                  <p className="text-xs text-text-secondary">{group.desc}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.items.map((f) => (
                    <div key={f.title} className="card-hover p-4 space-y-1.5">
                      <div className="w-7 h-7 rounded-md bg-accent-light text-accent-text flex items-center justify-center mb-2">
                        <f.icon className="w-3.5 h-3.5" aria-hidden="true" />
                      </div>
                      <h4 className="text-xs font-semibold text-text-primary">{f.title}</h4>
                      <p className="text-xs text-text-secondary leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 px-6 bg-surface border-t border-border">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center">
            <h2 className="text-xl font-bold text-text-primary tracking-tight">Frequently Asked Questions</h2>
          </div>
          <div className="divide-y divide-border">
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 bg-surface-subtle">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-secondary">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#5965B3] text-white flex items-center justify-center">
              <Bookmark className="w-3 h-3 fill-white/20" aria-hidden="true" />
            </div>
            <span className="font-semibold text-text-primary">StudyMate</span>
          </div>
          <p>© 2026 StudyMate Workspace</p>
        </div>
      </footer>
    </div>
  )
}
