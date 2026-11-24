import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain, Zap, BookOpen, BarChart3, Clock, Code2, FileText, Video,
  ScanLine, Map, Calculator, Trophy, ArrowRight,
  CheckCircle2, MessageSquare, ChevronDown, Bookmark
} from 'lucide-react'

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
      { icon: Zap, title: 'Flashcards', desc: 'Decks with spaced repetition algorithms' },
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
  { q: 'Is StudyMate free to use?', a: 'Yes, StudyMate includes a generous free tier for notes, study planner, focus timer, and basic study features.' },
  { q: 'How does PDF and document analysis work?', a: 'Upload any standard PDF and StudyMate extracts key topics, structural summaries, and practice questions.' },
  { q: 'Can I access StudyMate on mobile devices?', a: 'Yes. The entire application is fully responsive across desktop, laptop, tablet, and mobile browsers.' },
  { q: 'Is my study data stored securely?', a: 'Yes. All data is encrypted and saved to your private account context.' },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[#E7E5E0] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="text-sm font-semibold text-[#252525] group-hover:text-[#5965B3] transition-colors pr-4">{q}</span>
        <ChevronDown className={`w-4 h-4 text-[#999999] flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <p className="text-xs text-[#707070] leading-relaxed pb-4 pr-8 animate-fade-in">{a}</p>
      )}
    </div>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#252525]">
      {/* Header Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#E7E5E0] bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#5965B3] flex items-center justify-center text-white">
              <Bookmark className="w-4 h-4 fill-white/20" />
            </div>
            <span className="font-semibold text-[#252525] text-sm tracking-tight">StudyMate</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs font-medium text-[#707070]">
            <a href="#features" className="hover:text-[#252525] transition-colors">Features</a>
            <a href="#faq" className="hover:text-[#252525] transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn btn-ghost text-xs">Sign in</Link>
            <Link to="/register" className="btn btn-primary text-xs">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 pb-20 px-6 relative overflow-hidden bg-white border-b border-[#E7E5E0]">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ECEEF7] border border-[#5965B3]/20 text-[#5965B3] text-xs font-medium">
            <span>A thoughtful study workspace for modern students</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#252525] leading-tight">
            Study with focus. <br />
            <span className="text-[#5965B3]">Organize your academic life.</span>
          </h1>

          <p className="text-sm sm:text-base text-[#707070] max-w-lg mx-auto leading-relaxed">
            One clean workspace for notes, flashcards, document reading, focus timing, and course planning.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link to="/register" className="btn btn-primary btn-lg">
              <span>Open Study Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/login" className="btn btn-secondary btn-lg">
              <span>Sign In</span>
            </Link>
          </div>

          <div className="pt-8 flex flex-wrap justify-center gap-8 sm:gap-12 border-t border-[#E7E5E0] mt-8">
            {[
              { value: '50,000+', label: 'Students' },
              { value: '2M+', label: 'Hours studied' },
              { value: '98%', label: 'Satisfaction' },
              { value: '34%', label: 'Score boost' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-xl font-bold font-mono text-[#252525]">{stat.value}</div>
                <div className="text-xs text-[#707070]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 px-6">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[#252525] tracking-tight mb-1">
              Everything in one workspace
            </h2>
            <p className="text-xs text-[#707070]">
              Built to support every stage of your study routine.
            </p>
          </div>

          <div className="space-y-10">
            {featureGroups.map((group) => (
              <div key={group.title}>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-[#252525]">{group.title}</h3>
                  <p className="text-xs text-[#707070]">{group.desc}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.items.map((f) => (
                    <div key={f.title} className="card-hover bg-white p-4 border-[#E7E5E0] space-y-1.5">
                      <div className="w-7 h-7 rounded-md bg-[#ECEEF7] text-[#5965B3] flex items-center justify-center mb-2">
                        <f.icon className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-xs font-semibold text-[#252525]">{f.title}</h4>
                      <p className="text-xs text-[#707070] leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 px-6 bg-white border-t border-[#E7E5E0]">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center">
            <h2 className="text-xl font-bold text-[#252525] tracking-tight">Frequently Asked Questions</h2>
          </div>
          <div className="divide-y divide-[#E7E5E0]">
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E7E5E0] py-8 px-6 bg-[#FAF9F6]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#707070]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#5965B3] text-white flex items-center justify-center">
              <Bookmark className="w-3 h-3 fill-white/20" />
            </div>
            <span className="font-semibold text-[#252525]">StudyMate</span>
          </div>
          <p>© 2026 StudyMate Workspace</p>
        </div>
      </footer>
    </div>
  )
}
