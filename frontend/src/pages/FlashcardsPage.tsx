import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Zap, ChevronLeft, RotateCcw, Sparkles, BookOpen, Brain,
  ArrowLeft, Trash2, AlertCircle, Share2, Copy, Check, Download, WifiOff
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonGrid } from '@/components/ui/Skeleton'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { calculateSm2, formatIntervalLabel, type Sm2Rating } from '@/lib/sm2'
import api from '@/lib/api'

interface Flashcard {
  id: number
  front: string
  back: string
  difficulty: Sm2Rating | null
  easeFactor: number
  intervalDays: number
  repetitions: number
  lastReviewedAt: string | null
  dueDate: Date
  reviewCount: number
}

interface Deck {
  id: number
  name: string
  subject: string
  shareCode?: string | null
  isPublic?: boolean
  cards: Flashcard[]
  createdAt: Date
}

interface RawDeck {
  id: number
  name: string
  subject: string
  shareCode?: string | null
  isPublic?: boolean
  createdAt: string
  cards: Array<{
    id: number
    front: string
    back: string
    difficulty: Sm2Rating | null
    easeFactor?: number
    intervalDays?: number
    repetitions?: number
    lastReviewedAt?: string | null
    dueDate: string
    reviewCount: number
  }>
}

const OFFLINE_DECKS_KEY = 'studymate_offline_decks'

function mapCard(c: RawDeck['cards'][number]): Flashcard {
  return {
    id: c.id,
    front: c.front,
    back: c.back,
    difficulty: c.difficulty,
    easeFactor: typeof c.easeFactor === 'number' ? c.easeFactor : 250,
    intervalDays: typeof c.intervalDays === 'number' ? c.intervalDays : 0,
    repetitions: typeof c.repetitions === 'number' ? c.repetitions : 0,
    lastReviewedAt: c.lastReviewedAt ?? null,
    dueDate: new Date(c.dueDate),
    reviewCount: c.reviewCount || 0,
  }
}

function mapDeck(raw: RawDeck): Deck {
  return {
    id: raw.id,
    name: raw.name,
    subject: raw.subject,
    shareCode: raw.shareCode ?? null,
    isPublic: Boolean(raw.isPublic),
    createdAt: new Date(raw.createdAt),
    cards: (raw.cards || []).map(mapCard),
  }
}

const RATING_CONFIG: Array<{
  id: Sm2Rating
  label: string
  shortcut: string
  color: string
}> = [
  { id: 'again', label: 'Again', shortcut: '1', color: 'text-error bg-error-light border-error/40' },
  { id: 'hard', label: 'Hard', shortcut: '2', color: 'text-warning bg-warning-light border-warning/40' },
  { id: 'medium', label: 'Medium', shortcut: '3', color: 'text-accent-text bg-accent-light border-accent/40' },
  { id: 'easy', label: 'Easy', shortcut: '4', color: 'text-success bg-success-light border-success/40' },
]

function isCardDue(card: Flashcard): boolean {
  return card.dueDate.getTime() <= Date.now()
}

export function FlashcardsPage() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [offlineFallback, setOfflineFallback] = useState(false)
  const [activeDeckId, setActiveDeckId] = useState<number | null>(null)
  const [queueMode, setQueueMode] = useState<'due' | 'all'>('due')
  const [cardIndex, setCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importCode, setImportCode] = useState('')
  const [importing, setImporting] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [showAddCardModal, setShowAddCardModal] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckSubject, setNewDeckSubject] = useState('')
  const [manualFront, setManualFront] = useState('')
  const [manualBack, setManualBack] = useState('')
  const [draftCards, setDraftCards] = useState<Array<{ front: string; back: string }>>([])
  const [sourceText, setSourceText] = useState('')
  const [generatingCards, setGeneratingCards] = useState(false)
  const [savingCard, setSavingCard] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [sessionStats, setSessionStats] = useState<Record<Sm2Rating, number>>({
    again: 0,
    hard: 0,
    medium: 0,
    easy: 0,
  })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        setLoadError(null)
        const res = await api.get('/flashcards/decks')
        if (!active) return
        const raw = (res.data?.decks || []) as RawDeck[]
        try {
          localStorage.setItem(OFFLINE_DECKS_KEY, JSON.stringify(raw))
        } catch {}
        setOfflineFallback(false)
        setDecks(raw.map(mapDeck))
      } catch (error: unknown) {
        if (!active) return
        try {
          const cached = localStorage.getItem(OFFLINE_DECKS_KEY)
          if (cached) {
            const parsed = JSON.parse(cached) as RawDeck[]
            setDecks(parsed.map(mapDeck))
            setOfflineFallback(true)
            setLoadError(null)
            return
          }
        } catch {}
        const err = error as { response?: { data?: { error?: string } }; message?: string }
        setLoadError(err.response?.data?.error || err.message || 'Failed to load flashcard decks')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const activeDeck = useMemo(
    () => decks.find((d) => d.id === activeDeckId) ?? null,
    [decks, activeDeckId]
  )

  const reviewQueue = useMemo(() => {
    if (!activeDeck) return []
    if (queueMode === 'all') return activeDeck.cards
    return activeDeck.cards.filter(isCardDue)
  }, [activeDeck, queueMode])

  const currentCard = reviewQueue[cardIndex]
  const progress = reviewQueue.length > 0 ? (cardIndex / reviewQueue.length) * 100 : 0

  const handleFlip = useCallback(() => setIsFlipped(f => !f), [])

  const handleRating = useCallback(async (rating: Sm2Rating) => {
    if (!activeDeck || !currentCard) return
    const queueLenAtClick = reviewQueue.length
    setSessionStats(s => ({ ...s, [rating]: s[rating] + 1 }))
    setIsFlipped(false)

    const optimistic = calculateSm2(currentCard, rating)

    void api.patch(`/flashcards/cards/${currentCard.id}/review`, { difficulty: rating }).then((res) => {
      const savedCard = res.data?.card ? mapCard(res.data.card as RawDeck['cards'][number]) : null
      setDecks(prev => {
        const updated = prev.map(d => d.id === activeDeck.id ? {
          ...d,
          cards: d.cards.map(c => c.id === currentCard.id ? (savedCard ?? {
            ...c,
            difficulty: rating,
            easeFactor: optimistic.easeFactor,
            intervalDays: optimistic.intervalDays,
            repetitions: optimistic.repetitions,
            dueDate: optimistic.dueDate,
            reviewCount: c.reviewCount + 1,
          }) : c),
        } : d)
        return updated
      })
    }).catch(() => {
      toast.error('Failed to save flashcard review')
    })

    setTimeout(() => {
      if (cardIndex < queueLenAtClick - 1) {
        setCardIndex(i => i + 1)
      } else {
        setSessionComplete(true)
      }
    }, 260)
  }, [activeDeck, currentCard, reviewQueue.length, cardIndex])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!activeDeck || showAddCardModal || reviewQueue.length === 0) return
      if (e.key === ' ') { e.preventDefault(); handleFlip() }
      if (!isFlipped) return
      if (e.key === '1') void handleRating('again')
      if (e.key === '2' || e.key === 'ArrowLeft') void handleRating('hard')
      if (e.key === '3') void handleRating('medium')
      if (e.key === '4' || e.key === 'ArrowRight') void handleRating('easy')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeDeck, showAddCardModal, reviewQueue.length, isFlipped, handleFlip, handleRating])

  const startDeck = (deck: Deck, modeOverride?: 'due' | 'all') => {
    const dueCount = deck.cards.filter(isCardDue).length
    const nextMode = modeOverride ?? (dueCount > 0 ? 'due' : 'all')
    setQueueMode(nextMode)
    setActiveDeckId(deck.id)
    setCardIndex(0)
    setIsFlipped(false)
    setSessionComplete(false)
    setSessionStats({ again: 0, hard: 0, medium: 0, easy: 0 })
  }

  const addDraftCard = () => {
    if (!manualFront.trim() || !manualBack.trim()) {
      toast.error('Enter both front and back text')
      return
    }
    setDraftCards(prev => [...prev, { front: manualFront.trim(), back: manualBack.trim() }])
    setManualFront('')
    setManualBack('')
  }

  const createDeck = async () => {
    if (!newDeckName.trim()) {
      toast.error('Please enter a deck name')
      return
    }
    const pendingCard = manualFront.trim() && manualBack.trim()
      ? [{ front: manualFront.trim(), back: manualBack.trim() }]
      : []
    const cardsToSave = [...draftCards, ...pendingCard]

    try {
      const res = await api.post('/flashcards/decks', {
        name: newDeckName.trim(),
        subject: newDeckSubject.trim() || 'General',
        cards: cardsToSave,
      })
      const created = mapDeck(res.data.deck as RawDeck)
      setDecks(d => [created, ...d])
      setShowCreateModal(false)
      setNewDeckName('')
      setNewDeckSubject('')
      setManualFront('')
      setManualBack('')
      setDraftCards([])
      setSourceText('')
      toast.success(cardsToSave.length > 0 ? `Deck created with ${cardsToSave.length} flashcards` : 'Deck created')
      startDeck(created, 'all')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err.response?.data?.error || err.message || 'Failed to create deck')
    }
  }

  const addCardToActiveDeck = async () => {
    if (!activeDeck || !manualFront.trim() || !manualBack.trim()) {
      toast.error('Enter both question and answer')
      return
    }
    setSavingCard(true)
    try {
      const res = await api.post(`/flashcards/decks/${activeDeck.id}/cards`, {
        cards: [{ front: manualFront.trim(), back: manualBack.trim() }],
      })
      const inserted = ((res.data?.cards || []) as RawDeck['cards']).map(mapCard)
      setDecks(prev => prev.map(d => d.id === activeDeck.id ? { ...d, cards: [...d.cards, ...inserted] } : d))
      setManualFront('')
      setManualBack('')
      setShowAddCardModal(false)
      setSessionComplete(false)
      toast.success('Flashcard added')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err.response?.data?.error || err.message || 'Failed to add flashcard')
    } finally {
      setSavingCard(false)
    }
  }

  const deleteCurrentCard = async () => {
    if (!activeDeck || !currentCard) return
    try {
      await api.delete(`/flashcards/cards/${currentCard.id}`)
      const nextCards = activeDeck.cards.filter(c => c.id !== currentCard.id)
      setDecks(prev => prev.map(d => d.id === activeDeck.id ? { ...d, cards: nextCards } : d))
      setCardIndex(i => Math.max(0, Math.min(i, Math.max(0, reviewQueue.length - 2))))
      setIsFlipped(false)
      toast.success('Card removed')
    } catch {
      toast.error('Failed to delete card')
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

  const toggleShareDeck = async (e: React.MouseEvent, deck: Deck) => {
    e.stopPropagation()
    try {
      const res = await api.post(`/flashcards/decks/${deck.id}/share`, { isPublic: !deck.isPublic })
      const updated = mapDeck(res.data.deck as RawDeck)
      setDecks(prev => prev.map(d => d.id === deck.id ? updated : d))
      if (updated.isPublic && updated.shareCode) {
        try {
          await navigator.clipboard.writeText(updated.shareCode)
          setCopiedCode(updated.shareCode)
          setTimeout(() => setCopiedCode(null), 2000)
          toast.success(`Deck shared! Code ${updated.shareCode} copied`)
        } catch {
          toast.success(`Deck shared! Code: ${updated.shareCode}`)
        }
      } else {
        toast.success('Deck sharing turned off')
      }
    } catch {
      toast.error('Failed to update deck sharing')
    }
  }

  const copyShareCode = async (e: React.MouseEvent, code: string) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
      toast.success(`Copied code ${code}`)
    } catch {
      toast.error('Could not copy share code')
    }
  }

  const importSharedDeck = async () => {
    if (!importCode.trim()) {
      toast.error('Enter a share code')
      return
    }
    setImporting(true)
    try {
      const res = await api.post(`/flashcards/import/${encodeURIComponent(importCode.trim().toUpperCase())}`)
      const imported = mapDeck(res.data.deck as RawDeck)
      setDecks(prev => [imported, ...prev])
      setShowImportModal(false)
      setImportCode('')
      toast.success(`Imported "${imported.name}" (${imported.cards.length} cards)`)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err.response?.data?.error || err.message || 'Could not import shared deck')
    } finally {
      setImporting(false)
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
      setDraftCards([])
      toast.success(`Generated ${deck.cards.length} flashcards!`)
      startDeck(deck, 'all')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'Failed to generate flashcards'
      setAiError(msg)
      toast.error(msg)
    } finally {
      setGeneratingCards(false)
    }
  }

  const totalDue = useMemo(
    () => decks.reduce((sum, d) => sum + d.cards.filter(isCardDue).length, 0),
    [decks]
  )
  const totalCards = useMemo(
    () => decks.reduce((sum, d) => sum + d.cards.length, 0),
    [decks]
  )
  const totalReviews = useMemo(
    () => decks.reduce((sum, d) => sum + d.cards.reduce((cs, c) => cs + c.reviewCount, 0), 0),
    [decks]
  )

  if (activeDeck) {
    const dueInDeck = activeDeck.cards.filter(isCardDue).length
    const reviewedCount = sessionStats.again + sessionStats.hard + sessionStats.medium + sessionStats.easy

    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveDeckId(null)}
            className="btn-icon text-text-secondary hover:text-text-primary"
            aria-label="Back to flashcard decks"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-text-primary truncate">{activeDeck.name}</h1>
            <p className="text-xs text-text-secondary">{activeDeck.subject} • SM-2 Spaced Repetition</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setQueueMode('due'); setCardIndex(0); setSessionComplete(false); setIsFlipped(false) }}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                queueMode === 'due' ? 'bg-accent-light border-accent text-accent-text' : 'bg-surface border-border text-text-secondary'
              )}
            >
              Due ({dueInDeck})
            </button>
            <button
              type="button"
              onClick={() => { setQueueMode('all'); setCardIndex(0); setSessionComplete(false); setIsFlipped(false) }}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                queueMode === 'all' ? 'bg-accent-light border-accent text-accent-text' : 'bg-surface border-border text-text-secondary'
              )}
            >
              All ({activeDeck.cards.length})
            </button>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setShowAddCardModal(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Add card
          </Button>
          {reviewQueue.length > 0 && (
            <span className="text-xs font-mono text-text-secondary">{cardIndex + 1} / {reviewQueue.length}</span>
          )}
        </div>

        <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {activeDeck.cards.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="This deck has no cards yet"
            description="Add your first flashcard to start reviewing with SM-2 spaced repetition."
            action={<Button onClick={() => setShowAddCardModal(true)} leftIcon={<Plus className="w-4 h-4" />}>Add first card</Button>}
          />
        ) : queueMode === 'due' && reviewQueue.length === 0 ? (
          <EmptyState
            icon={Check}
            title="All caught up for today"
            description="Every card in this deck is scheduled for future review."
            action={<Button variant="secondary" onClick={() => setQueueMode('all')} leftIcon={<RotateCcw className="w-4 h-4" />}>Practice all {activeDeck.cards.length} cards</Button>}
          />
        ) : sessionComplete ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10 bg-surface border border-border rounded-xl p-6 shadow-xs">
            <h2 className="text-2xl font-bold text-text-primary mb-1">Session Complete</h2>
            <p className="text-xs text-text-secondary mb-6">You reviewed {reviewedCount} cards using SM-2 scheduling</p>
            <div className="flex justify-center gap-6 mb-8">
              <div className="text-center"><div className="text-2xl font-bold text-error font-mono">{sessionStats.again}</div><div className="text-xs text-text-secondary">Again</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-warning font-mono">{sessionStats.hard}</div><div className="text-xs text-text-secondary">Hard</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-accent-text font-mono">{sessionStats.medium}</div><div className="text-xs text-text-secondary">Medium</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-success font-mono">{sessionStats.easy}</div><div className="text-xs text-text-secondary">Easy</div></div>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" leftIcon={<RotateCcw className="w-4 h-4" />} onClick={() => startDeck(activeDeck, 'all')}>Review All Again</Button>
              <Button onClick={() => setActiveDeckId(null)} leftIcon={<ArrowLeft className="w-4 h-4" />}>Back to Decks</Button>
            </div>
          </motion.div>
        ) : currentCard ? (
          <>
            <div className="flex items-center justify-between text-[11px] text-text-muted font-mono">
              <span>Reps: {currentCard.repetitions} • Ease: {(currentCard.easeFactor / 100).toFixed(2)}×</span>
              <span>Current interval: {formatIntervalLabel(currentCard.intervalDays)}</span>
            </div>
            <div
              role="button"
              tabIndex={0}
              aria-label={isFlipped ? 'Flashcard answer shown, press space to flip back' : 'Flashcard front shown, press space to reveal answer'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFlip()
              }}
              className="flip-card w-full aspect-[3/2] cursor-pointer"
              onClick={handleFlip}
            >
              <div className={cn('flip-card-inner w-full h-full relative', isFlipped && 'flipped')}>
                <div className="flip-card-front absolute inset-0 card bg-surface border-border shadow-xs flex flex-col items-center justify-center p-8 text-center">
                  <div className="text-[11px] text-text-muted uppercase tracking-wider font-semibold mb-3">Front</div>
                  <p className="text-lg font-semibold text-text-primary leading-relaxed">{currentCard.front}</p>
                  <div className="mt-6 text-xs text-text-muted">Tap or press Space to reveal answer</div>
                </div>
                <div className="flip-card-back absolute inset-0 card bg-surface-subtle border-border shadow-xs flex flex-col items-center justify-center p-8 text-center">
                  <div className="text-[11px] text-accent-text uppercase tracking-wider font-semibold mb-3">Answer</div>
                  <p className="text-base font-semibold text-text-primary leading-relaxed">{currentCard.back}</p>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {isFlipped && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="grid grid-cols-4 gap-2.5 pt-2"
                >
                  {RATING_CONFIG.map((cfg) => {
                    const next = calculateSm2(currentCard, cfg.id)
                    return (
                      <button
                        type="button"
                        key={cfg.id}
                        onClick={() => void handleRating(cfg.id)}
                        className={cn('py-2.5 px-2 rounded-lg border font-medium text-xs transition-all hover:opacity-90', cfg.color)}
                      >
                        <div>{cfg.label} <span className="opacity-60 font-mono text-[10px]">[{cfg.shortcut}]</span></div>
                        <div className="text-[10px] opacity-85 mt-0.5 font-mono">in {formatIntervalLabel(next.intervalDays)}</div>
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {!isFlipped && (
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => cardIndex > 0 && (setCardIndex(i => i - 1), setIsFlipped(false))}
                  className="btn btn-secondary btn-sm"
                  aria-label="Previous card"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button type="button" onClick={handleFlip} className="btn btn-primary gap-2"><RotateCcw className="w-4 h-4" /> Flip card</button>
                <button
                  type="button"
                  onClick={() => void deleteCurrentCard()}
                  className="btn btn-secondary btn-sm text-error"
                  title="Remove card"
                  aria-label="Remove card"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        ) : null}

        <Modal open={showAddCardModal} onClose={() => setShowAddCardModal(false)} title="Add Flashcard" size="sm">
          <div className="space-y-4">
            <Input
              id="add-front"
              label="Front (Question / Term)"
              placeholder="e.g. What is Newton's Second Law?"
              value={manualFront}
              onChange={e => setManualFront(e.target.value)}
            />
            <div>
              <label htmlFor="add-back" className="input-label">Back (Answer / Definition)</label>
              <textarea
                id="add-back"
                value={manualBack}
                onChange={e => setManualBack(e.target.value)}
                placeholder="e.g. Force equals mass times acceleration (F = ma)."
                rows={3}
                className="input text-xs resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowAddCardModal(false)}>Cancel</Button>
              <Button className="flex-1" isLoading={savingCard} onClick={() => void addCardToActiveDeck()}>Save card</Button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Flashcards</h1>
          <p className="text-text-secondary text-sm mt-1">SM-2 spaced repetition, daily due queue, and shared study decks</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowImportModal(true)} leftIcon={<Download className="w-4 h-4" />}>
            Import deck
          </Button>
          <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="w-4 h-4" />}>
            New deck
          </Button>
        </div>
      </div>

      {offlineFallback && (
        <div className="p-3 rounded-xl bg-warning-light border border-warning/30 text-xs text-warning flex items-center gap-2">
          <WifiOff className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>Showing offline cached flashcard decks. Reviews will sync once you reconnect.</span>
        </div>
      )}

      {!loading && decks.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3.5 bg-surface border-border">
            <div className="text-[11px] text-text-secondary">Due Today</div>
            <div className="text-xl font-bold font-mono text-accent-text">{totalDue}</div>
          </div>
          <div className="card p-3.5 bg-surface border-border">
            <div className="text-[11px] text-text-secondary">Total Cards</div>
            <div className="text-xl font-bold font-mono text-text-primary">{totalCards}</div>
          </div>
          <div className="card p-3.5 bg-surface border-border">
            <div className="text-[11px] text-text-secondary">Total Reviews</div>
            <div className="text-xl font-bold font-mono text-success">{totalReviews}</div>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonGrid count={6} />
      ) : loadError ? (
        <div className="p-4 rounded-xl bg-error-light border border-error/30 text-xs text-error">{loadError}</div>
      ) : decks.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No flashcard decks yet"
          description="Create a deck with manual cards, generate AI flashcards, or import a shared deck by code."
          action={<Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="w-4 h-4" />}>Create deck</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => {
            const mastered = deck.cards.filter(c => c.repetitions >= 2 || c.difficulty === 'easy').length
            const dueCount = deck.cards.filter(isCardDue).length
            const pct = deck.cards.length > 0 ? Math.round((mastered / deck.cards.length) * 100) : 0
            return (
              <motion.div
                key={deck.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-hover bg-surface border-border p-5 shadow-xs flex flex-col justify-between group"
                onClick={() => startDeck(deck)}
              >
                <div>
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="w-9 h-9 rounded-lg bg-accent-light flex items-center justify-center text-accent-text flex-shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {dueCount > 0 && <Badge variant="brand">{dueCount} due</Badge>}
                      <Badge variant="neutral">{deck.cards.length} cards</Badge>
                      <button
                        type="button"
                        onClick={(e) => void toggleShareDeck(e, deck)}
                        className={cn(
                          'p-1 transition-colors',
                          deck.isPublic ? 'text-accent-text' : 'text-text-muted hover:text-text-primary'
                        )}
                        title={deck.isPublic ? 'Publicly shared (click to unshare)' : 'Share deck with code'}
                        aria-label={`Share ${deck.name} deck`}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => void deleteDeck(e, deck.id)}
                        className="p-1 text-text-muted hover:text-error sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        title="Delete deck"
                        aria-label={`Delete ${deck.name} deck`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-text-primary text-sm mb-0.5">{deck.name}</h3>
                  <p className="text-xs text-text-secondary mb-3">{deck.subject}</p>
                  {deck.isPublic && deck.shareCode && (
                    <button
                      type="button"
                      onClick={(e) => void copyShareCode(e, deck.shareCode!)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono bg-accent-light text-accent-text px-2 py-0.5 rounded mb-3 hover:opacity-85"
                    >
                      {copiedCode === deck.shareCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      Code: {deck.shareCode}
                    </button>
                  )}
                </div>

                <div>
                  <div className="h-1 bg-surface-secondary rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-text-muted font-mono">{pct}% mastered</span>
                    <button type="button" className="btn btn-primary btn-sm">
                      {dueCount > 0 ? `Review (${dueCount})` : 'Study →'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <Modal open={showImportModal} onClose={() => setShowImportModal(false)} title="Import Shared Deck" size="sm">
        <div className="space-y-4">
          <Input
            id="share-code-input"
            label="Deck Share Code"
            placeholder="e.g. A4B9C2D1"
            value={importCode}
            onChange={(e) => setImportCode(e.target.value.toUpperCase())}
          />
          <p className="text-xs text-text-secondary">
            Ask a classmate to toggle Share on any of their flashcard decks and share their 8-character code.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowImportModal(false)}>Cancel</Button>
            <Button className="flex-1" isLoading={importing} onClick={() => void importSharedDeck()}>Import Deck</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Flashcard Deck">
        <div className="space-y-4">
          <Input id="deck-name" label="Deck name / topic" placeholder="e.g. Calculus Fundamentals" value={newDeckName} onChange={e => setNewDeckName(e.target.value)} />
          <Input id="deck-subject" label="Subject" placeholder="e.g. Mathematics" value={newDeckSubject} onChange={e => setNewDeckSubject(e.target.value)} />

          <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">Add Cards Manually</span>
              <Badge variant="neutral">{draftCards.length} ready</Badge>
            </div>
            <input
              value={manualFront}
              onChange={e => setManualFront(e.target.value)}
              placeholder="Front (Question or term)..."
              aria-label="Manual card front"
              className="input text-xs py-1.5"
            />
            <input
              value={manualBack}
              onChange={e => setManualBack(e.target.value)}
              placeholder="Back (Answer or definition)..."
              aria-label="Manual card back"
              className="input text-xs py-1.5"
            />
            <Button type="button" variant="secondary" size="sm" onClick={addDraftCard} leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add card to list
            </Button>
            {draftCards.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-1 pt-1">
                {draftCards.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] bg-surface-subtle px-2.5 py-1.5 rounded border border-border">
                    <span className="truncate font-medium text-text-primary">{c.front}</span>
                    <button
                      type="button"
                      onClick={() => setDraftCards(prev => prev.filter((_, i) => i !== idx))}
                      className="text-text-muted hover:text-error ml-2"
                      aria-label={`Remove draft card ${idx + 1}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-surface-subtle border border-border space-y-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-text" />
              <span className="text-xs font-semibold text-text-primary">AI Generation</span>
            </div>
            <p className="text-xs text-text-secondary">Optionally paste notes or generate directly from the deck topic</p>
            <textarea
              value={sourceText}
              onChange={e => setSourceText(e.target.value)}
              placeholder="Optional: paste notes, definitions, or key concepts..."
              aria-label="Optional source notes for AI flashcards"
              rows={2}
              className="input text-xs resize-none"
            />
            {aiError && (
              <div className="p-2.5 rounded-lg bg-error-light border border-error/30 text-[11px] text-error flex items-start gap-2">
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
            <Button className="flex-1" onClick={() => void createDeck()}>
              {draftCards.length > 0 || (manualFront.trim() && manualBack.trim()) ? 'Create deck with cards' : 'Create deck'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
