import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Zap, ChevronLeft, RotateCcw, Sparkles, BookOpen, Brain, ArrowLeft, Trash2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

interface Flashcard {
  id: number
  front: string
  back: string
  difficulty: 'easy' | 'medium' | 'hard' | null
  dueDate: Date
  reviewCount: number
}

interface Deck {
  id: number
  name: string
  subject: string
  cards: Flashcard[]
  createdAt: Date
}

interface RawDeck {
  id: number
  name: string
  subject: string
  createdAt: string
  cards: Array<{
    id: number
    front: string
    back: string
    difficulty: 'easy' | 'medium' | 'hard' | null
    dueDate: string
    reviewCount: number
  }>
}

function mapDeck(raw: RawDeck): Deck {
  return {
    id: raw.id,
    name: raw.name,
    subject: raw.subject,
    createdAt: new Date(raw.createdAt),
    cards: (raw.cards || []).map(c => ({
      ...c,
      dueDate: new Date(c.dueDate),
    })),
  }
}

const difficultyConfig = {
  easy: { label: 'Easy', color: 'text-[#5C8A6A] bg-[#EDF5F0] border-[#5C8A6A]', next: 7 },
  medium: { label: 'Medium', color: 'text-[#B4863A] bg-[#FBF5EC] border-[#B4863A]', next: 3 },
  hard: { label: 'Hard', color: 'text-[#B45D5D] bg-[#FBEFEF] border-[#B45D5D]', next: 1 },
}

export function FlashcardsPage() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null)
  const [cardIndex, setCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckSubject, setNewDeckSubject] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [generatingCards, setGeneratingCards] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [sessionStats, setSessionStats] = useState({ easy: 0, medium: 0, hard: 0 })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        setLoadError(null)
        const res = await api.get('/flashcards/decks')
        if (!active) return
        setDecks(((res.data?.decks || []) as RawDeck[]).map(mapDeck))
      } catch (error: unknown) {
        if (!active) return
        const err = error as { response?: { data?: { error?: string } }; message?: string }
        setLoadError(err.response?.data?.error || err.message || 'Failed to load flashcard decks')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const currentCard = activeDeck?.cards[cardIndex]
  const progress = activeDeck && activeDeck.cards.length > 0 ? (cardIndex / activeDeck.cards.length) * 100 : 0

  const handleFlip = useCallback(() => setIsFlipped(f => !f), [])

  const handleDifficulty = useCallback(async (difficulty: 'easy' | 'medium' | 'hard') => {
    if (!activeDeck || !currentCard) return
    setSessionStats(s => ({ ...s, [difficulty]: s[difficulty] + 1 }))
    setIsFlipped(false)

    void api.patch(`/flashcards/cards/${currentCard.id}/review`, { difficulty }).then(() => {
      setDecks(prev => prev.map(d => d.id === activeDeck.id ? {
        ...d,
        cards: d.cards.map(c => c.id === currentCard.id ? { ...c, difficulty, reviewCount: c.reviewCount + 1 } : c),
      } : d))
    }).catch(() => {})

    setTimeout(() => {
      if (cardIndex < activeDeck.cards.length - 1) {
        setCardIndex(i => i + 1)
      } else {
        setSessionComplete(true)
      }
    }, 300)
  }, [activeDeck, currentCard, cardIndex])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!activeDeck) return
      if (e.key === ' ') { e.preventDefault(); handleFlip() }
      if (e.key === 'ArrowRight' && isFlipped) void handleDifficulty('easy')
      if (e.key === 'ArrowLeft' && isFlipped) void handleDifficulty('hard')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeDeck, isFlipped, handleFlip, handleDifficulty])

  const startDeck = (deck: Deck) => {
    if (deck.cards.length === 0) {
      toast.error('This deck has no cards yet')
      return
    }
    setActiveDeck(deck)
    setCardIndex(0)
    setIsFlipped(false)
    setSessionComplete(false)
    setSessionStats({ easy: 0, medium: 0, hard: 0 })
  }

  const createDeck = async (cards: Array<{ front: string; back: string }> = []) => {
    if (!newDeckName.trim()) {
      toast.error('Please enter a deck name')
      return
    }
    try {
      const res = await api.post('/flashcards/decks', {
        name: newDeckName.trim(),
        subject: newDeckSubject.trim() || 'General',
        cards,
      })
      const created = mapDeck(res.data.deck as RawDeck)
      setDecks(d => [created, ...d])
      setShowCreateModal(false)
      setNewDeckName('')
      setNewDeckSubject('')
      setSourceText('')
      toast.success(cards.length > 0 ? `Deck created with ${cards.length} AI flashcards` : 'Deck created')
      if (created.cards.length > 0) startDeck(created)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err.response?.data?.error || err.message || 'Failed to create deck')
    }
  }

  const deleteDeck = async (e: React.MouseEvent, deckId: number) => {
    e.stopPropagation()
    try {
      await api.delete(`/flashcards/decks/${deckId}`)
      setDecks(d => d.filter(item => item.id !== deckId))
      toast.success('Deck deleted')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err.response?.data?.error || err.message || 'Failed to delete deck')
    }
  }

  const generateWithAI = async () => {
    const topic = newDeckName.trim()
    if (!topic && !sourceText.trim()) {
      const msg = 'Enter a deck name/topic or paste study notes first'
      setAiError(msg)
      toast.error(msg)
      return
    }
    setGeneratingCards(true)
    setAiError(null)
    try {
      const response = await api.post('/ai/flashcards', {
        topic: topic || 'Study Material',
        subject: newDeckSubject.trim() || 'General',
        sourceText: sourceText.trim() || undefined,
        count: 8,
      })
      const rawCards: Array<{ front: string; back: string }> = response.data?.cards || []
      if (!rawCards.length) {
        const msg = 'No flashcards were generated'
        setAiError(msg)
        toast.error(msg)
        return
      }
      const deckRes = await api.post('/flashcards/decks', {
        name: topic || 'AI Study Deck',
        subject: newDeckSubject.trim() || 'General',
        cards: rawCards,
      })
      const deck = mapDeck(deckRes.data.deck as RawDeck)
      setDecks(d => [deck, ...d])
      setShowCreateModal(false)
      setNewDeckName('')
      setNewDeckSubject('')
      setSourceText('')
      toast.success(`Generated ${deck.cards.length} flashcards!`)
      startDeck(deck)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'Failed to generate flashcards'
      setAiError(msg)
      toast.error(msg)
    } finally {
      setGeneratingCards(false)
    }
  }

  if (activeDeck) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveDeck(null)} className="btn-icon text-[#707070] hover:text-[#252525]">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#252525]">{activeDeck.name}</h1>
            <p className="text-xs text-[#707070]">{activeDeck.subject}</p>
          </div>
          <span className="text-xs font-mono text-[#707070]">{cardIndex + 1} / {activeDeck.cards.length}</span>
        </div>

        <div className="h-1.5 bg-[#F0F0ED] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#5965B3] rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {sessionComplete ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10 bg-white border border-[#E7E5E0] rounded-xl p-6">
            <h2 className="text-2xl font-bold text-[#252525] mb-1">Session Complete</h2>
            <p className="text-xs text-[#707070] mb-6">You reviewed {activeDeck.cards.length} cards</p>
            <div className="flex justify-center gap-6 mb-8">
              <div className="text-center"><div className="text-2xl font-bold text-[#5C8A6A] font-mono">{sessionStats.easy}</div><div className="text-xs text-[#707070]">Easy</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-[#B4863A] font-mono">{sessionStats.medium}</div><div className="text-xs text-[#707070]">Medium</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-[#B45D5D] font-mono">{sessionStats.hard}</div><div className="text-xs text-[#707070]">Hard</div></div>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" leftIcon={<RotateCcw className="w-4 h-4" />} onClick={() => startDeck(activeDeck)}>Review Again</Button>
              <Button onClick={() => setActiveDeck(null)} leftIcon={<ArrowLeft className="w-4 h-4" />}>Back to Decks</Button>
            </div>
          </motion.div>
        ) : currentCard ? (
          <>
            <div className="flip-card w-full aspect-[3/2] cursor-pointer" onClick={handleFlip}>
              <div className={cn('flip-card-inner w-full h-full relative', isFlipped && 'flipped')}>
                <div className="flip-card-front absolute inset-0 card bg-white border-[#E7E5E0] shadow-xs flex flex-col items-center justify-center p-8 text-center">
                  <div className="text-[11px] text-[#999999] uppercase tracking-wider font-semibold mb-3">Front</div>
                  <p className="text-lg font-semibold text-[#252525] leading-relaxed">{currentCard.front}</p>
                  <div className="mt-6 text-xs text-[#999999]">Tap or press Space to reveal answer</div>
                </div>
                <div className="flip-card-back absolute inset-0 card bg-[#FAF9F6] border-[#E7E5E0] shadow-xs flex flex-col items-center justify-center p-8 text-center">
                  <div className="text-[11px] text-[#5965B3] uppercase tracking-wider font-semibold mb-3">Answer</div>
                  <p className="text-base font-semibold text-[#252525] leading-relaxed">{currentCard.back}</p>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {isFlipped && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="flex gap-3 pt-2"
                >
                  {(['hard', 'medium', 'easy'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => void handleDifficulty(d)}
                      className={cn('flex-1 py-2.5 rounded-lg border font-medium text-xs transition-all hover:opacity-90', difficultyConfig[d].color)}
                    >
                      {difficultyConfig[d].label}
                      <div className="text-[10px] opacity-75 mt-0.5 font-mono">in {difficultyConfig[d].next}d</div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {!isFlipped && (
              <div className="flex justify-center gap-3 pt-2">
                <button onClick={() => cardIndex > 0 && (setCardIndex(i => i - 1), setIsFlipped(false))} className="btn btn-secondary btn-sm"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={handleFlip} className="btn btn-primary gap-2"><RotateCcw className="w-4 h-4" /> Flip card</button>
              </div>
            )}
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#252525] tracking-tight">Flashcards</h1>
          <p className="text-[#707070] text-sm mt-1">Study materials using spaced repetition</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="w-4 h-4" />}>New deck</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-[#707070]">Loading flashcard decks...</div>
      ) : loadError ? (
        <div className="p-4 rounded-xl bg-[#FBEFEF] border border-[#B45D5D]/30 text-xs text-[#B45D5D]">{loadError}</div>
      ) : decks.length === 0 ? (
        <EmptyState icon={Zap} title="No flashcard decks yet" description="Create a deck or generate AI flashcards to start reviewing." action={<Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="w-4 h-4" />}>Create deck</Button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => {
            const mastered = deck.cards.filter(c => c.difficulty === 'easy').length
            const pct = deck.cards.length > 0 ? Math.round((mastered / deck.cards.length) * 100) : 0
            return (
              <motion.div
                key={deck.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-hover bg-white border-[#E7E5E0] p-5 shadow-xs flex flex-col justify-between group"
                onClick={() => startDeck(deck)}
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-[#ECEEF7] flex items-center justify-center text-[#5965B3]">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="neutral">{deck.cards.length} cards</Badge>
                      <button
                        onClick={(e) => void deleteDeck(e, deck.id)}
                        className="p-1 text-[#999999] hover:text-[#B45D5D] opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete deck"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-[#252525] text-sm mb-0.5">{deck.name}</h3>
                  <p className="text-xs text-[#707070] mb-4">{deck.subject}</p>
                </div>

                <div>
                  <div className="h-1 bg-[#F0F0ED] rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-[#5965B3] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#999999] font-mono">{pct}% mastered</span>
                    <button className="btn btn-primary btn-sm">Study →</button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Flashcard Deck">
        <div className="space-y-4">
          <Input id="deck-name" label="Deck name / topic" placeholder="e.g. Calculus Fundamentals" value={newDeckName} onChange={e => setNewDeckName(e.target.value)} />
          <Input id="deck-subject" label="Subject" placeholder="e.g. Mathematics" value={newDeckSubject} onChange={e => setNewDeckSubject(e.target.value)} />
          <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E7E5E0] space-y-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#5965B3]" />
              <span className="text-xs font-semibold text-[#252525]">AI Generation</span>
            </div>
            <p className="text-xs text-[#707070]">Optionally paste notes or generate directly from the deck topic</p>
            <textarea
              value={sourceText}
              onChange={e => setSourceText(e.target.value)}
              placeholder="Optional: paste notes, definitions, or key concepts..."
              rows={3}
              className="input text-xs resize-none"
            />
            {aiError && (
              <div className="p-2.5 rounded-lg bg-[#FBEFEF] border border-[#B45D5D]/30 text-[11px] text-[#B45D5D] flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{aiError}</span>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateWithAI}
              isLoading={generatingCards}
              leftIcon={<Brain className="w-3.5 h-3.5" />}
            >
              {generatingCards ? 'Generating flashcards...' : 'Generate 8 AI flashcards'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setShowCreateModal(false); setAiError(null) }}>Cancel</Button>
            <Button className="flex-1" onClick={() => void createDeck()}>Create empty deck</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
