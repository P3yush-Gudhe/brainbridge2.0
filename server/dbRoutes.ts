import { Router } from 'express'
import type { Response } from 'express'
import { requireAuth, type AuthRequest } from '../src/middleware/auth.ts'
import { deleteUserById, updateUserProfile } from '../src/db/users.ts'
import {
  addCardsToDeck,
  appendChatMessages,
  createAttendanceSubject,
  createCgpaCourse,
  createCgpaSemester,
  createChatConversation,
  createStudyExam,
  createStudyTasks,
  createUserDeck,
  createUserNote,
  deleteAttendanceSubject,
  deleteCgpaCourse,
  deleteChatConversation,
  deleteFlashcard,
  deleteStudyExam,
  deleteStudyTask,
  deleteUserDeck,
  deleteUserNote,
  exportAllUserData,
  getAnalyticsAndMilestones,
  getDashboardSummary,
  getLeaderboard,
  listAttendanceSubjects,
  listCgpaSemesters,
  listChatConversations,
  listPlannerData,
  listPomodoroStats,
  listQuizAttempts,
  listUserDecks,
  listUserNotes,
  markAttendanceSubject,
  recordPomodoroSession,
  recordQuizAttempt,
  reviewFlashcard,
  searchWorkspace,
  toggleStudyTask,
  updateChatConversationTitle,
  updateChatMessageLike,
  updateCgpaCourse,
  updateUserNote,
} from '../src/db/workspace.ts'

export const dbRouter = Router()

dbRouter.use(requireAuth)

function parsePositiveId(raw: string | string[] | undefined): number | null {
  const val = Array.isArray(raw) ? raw[0] : raw
  const num = Number(val)
  return Number.isInteger(num) && num > 0 ? num : null
}

function handleError(res: Response, error: unknown, fallback = 'Request failed') {
  const message = error instanceof Error ? error.message : fallback
  res.status(500).json({ error: message })
}

// ── Account & Profile ────────────────────────────────────────────────────────

dbRouter.get('/auth/me', async (req: AuthRequest, res: Response) => {
  res.json({ user: req.dbUser })
})

dbRouter.patch('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const dbUser = req.dbUser!
    const updates: {
      name?: string
      bio?: string
      university?: string
      year?: string
    } = {}
    if (typeof req.body?.name === 'string') updates.name = req.body.name.trim().slice(0, 120)
    if (typeof req.body?.bio === 'string') updates.bio = req.body.bio.trim().slice(0, 500)
    if (typeof req.body?.university === 'string') updates.university = req.body.university.trim().slice(0, 150)
    if (typeof req.body?.year === 'string') updates.year = req.body.year.trim().slice(0, 60)

    const updated = await updateUserProfile(dbUser.id, updates)
    res.json({ user: updated })
  } catch (error) {
    handleError(res, error, 'Failed to update profile')
  }
})

dbRouter.get('/account/export', async (req: AuthRequest, res: Response) => {
  try {
    const data = await exportAllUserData(req.dbUser!.id)
    res.json(data)
  } catch (error) {
    handleError(res, error, 'Failed to export data')
  }
})

dbRouter.delete('/account', async (req: AuthRequest, res: Response) => {
  try {
    await deleteUserById(req.dbUser!.id)
    res.json({ ok: true })
  } catch (error) {
    handleError(res, error, 'Failed to delete account')
  }
})

// ── Dashboard & Search ───────────────────────────────────────────────────────

dbRouter.get('/dashboard/summary', async (req: AuthRequest, res: Response) => {
  try {
    const summary = await getDashboardSummary(req.dbUser!.id)
    res.json(summary)
  } catch (error) {
    handleError(res, error, 'Failed to load dashboard')
  }
})

dbRouter.get('/analytics', async (req: AuthRequest, res: Response) => {
  try {
    const data = await getAnalyticsAndMilestones(req.dbUser!.id)
    res.json(data)
  } catch (error) {
    handleError(res, error, 'Failed to load analytics')
  }
})

dbRouter.get('/leaderboard', async (req: AuthRequest, res: Response) => {
  try {
    const entries = await getLeaderboard(req.dbUser!.id)
    res.json({ entries })
  } catch (error) {
    handleError(res, error, 'Failed to load leaderboard')
  }
})

dbRouter.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : ''
    const results = await searchWorkspace(req.dbUser!.id, q)
    res.json(results)
  } catch (error) {
    handleError(res, error, 'Search failed')
  }
})

// ── Notes ────────────────────────────────────────────────────────────────────

dbRouter.get('/notes', async (req: AuthRequest, res: Response) => {
  try {
    const items = await listUserNotes(req.dbUser!.id)
    res.json({ notes: items })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.post('/notes', async (req: AuthRequest, res: Response) => {
  try {
    const title = String(req.body?.title || 'Untitled Note').trim().slice(0, 200)
    const content = typeof req.body?.content === 'string' ? req.body.content : ''
    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.filter((t: unknown): t is string => typeof t === 'string').slice(0, 20)
      : []
    const note = await createUserNote(req.dbUser!.id, { title, content, tags })
    res.status(201).json({ note })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.patch('/notes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const noteId = parsePositiveId(req.params.id)
    if (!noteId) {
      res.status(400).json({ error: 'Invalid note ID' })
      return
    }
    const updates: { title?: string; content?: string; tags?: string[] } = {}
    if (typeof req.body?.title === 'string') updates.title = req.body.title.slice(0, 200)
    if (typeof req.body?.content === 'string') updates.content = req.body.content
    if (Array.isArray(req.body?.tags)) {
      updates.tags = req.body.tags.filter((t: unknown): t is string => typeof t === 'string').slice(0, 20)
    }

    const note = await updateUserNote(req.dbUser!.id, noteId, updates)
    if (!note) {
      res.status(404).json({ error: 'Note not found' })
      return
    }
    res.json({ note })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.delete('/notes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const noteId = parsePositiveId(req.params.id)
    if (!noteId) {
      res.status(400).json({ error: 'Invalid note ID' })
      return
    }
    const ok = await deleteUserNote(req.dbUser!.id, noteId)
    if (!ok) {
      res.status(404).json({ error: 'Note not found' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    handleError(res, error)
  }
})

// ── Flashcards ───────────────────────────────────────────────────────────────

dbRouter.get('/flashcards/decks', async (req: AuthRequest, res: Response) => {
  try {
    const decks = await listUserDecks(req.dbUser!.id)
    res.json({ decks })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.post('/flashcards/decks', async (req: AuthRequest, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 150)
    if (!name) {
      res.status(400).json({ error: 'Deck name is required' })
      return
    }
    const subject = String(req.body?.subject || 'General').trim().slice(0, 100)
    const cards = Array.isArray(req.body?.cards)
      ? req.body.cards
          .filter(
            (c: unknown): c is { front: string; back: string } =>
              Boolean(c && typeof (c as { front?: unknown }).front === 'string' && typeof (c as { back?: unknown }).back === 'string')
          )
          .slice(0, 50)
      : []

    const deck = await createUserDeck(req.dbUser!.id, { name, subject, cards })
    res.status(201).json({ deck })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.patch('/flashcards/cards/:id/review', async (req: AuthRequest, res: Response) => {
  try {
    const cardId = parsePositiveId(req.params.id)
    if (!cardId) {
      res.status(400).json({ error: 'Invalid card ID' })
      return
    }
    const diff = req.body?.difficulty
    if (diff !== 'easy' && diff !== 'medium' && diff !== 'hard') {
      res.status(400).json({ error: 'Difficulty must be easy, medium, or hard' })
      return
    }
    const card = await reviewFlashcard(req.dbUser!.id, cardId, diff)
    if (!card) {
      res.status(404).json({ error: 'Flashcard not found' })
      return
    }
    res.json({ card })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.delete('/flashcards/decks/:id', async (req: AuthRequest, res: Response) => {
  try {
    const deckId = parsePositiveId(req.params.id)
    if (!deckId) {
      res.status(400).json({ error: 'Invalid deck ID' })
      return
    }
    const ok = await deleteUserDeck(req.dbUser!.id, deckId)
    if (!ok) {
      res.status(404).json({ error: 'Deck not found' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.post('/flashcards/decks/:id/cards', async (req: AuthRequest, res: Response) => {
  try {
    const deckId = parsePositiveId(req.params.id)
    if (!deckId) {
      res.status(400).json({ error: 'Invalid deck ID' })
      return
    }
    const rawCards = Array.isArray(req.body?.cards)
      ? req.body.cards
      : req.body?.front && req.body?.back
        ? [{ front: req.body.front, back: req.body.back }]
        : []
    const cards = rawCards
      .filter(
        (c: unknown): c is { front: string; back: string } =>
          Boolean(
            c &&
              typeof (c as { front?: unknown }).front === 'string' &&
              (c as { front: string }).front.trim() &&
              typeof (c as { back?: unknown }).back === 'string' &&
              (c as { back: string }).back.trim()
          )
      )
      .slice(0, 50)
      .map((c: { front: string; back: string }) => ({
        front: c.front.trim().slice(0, 500),
        back: c.back.trim().slice(0, 1000),
      }))

    if (!cards.length) {
      res.status(400).json({ error: 'Card front and back text are required' })
      return
    }

    const inserted = await addCardsToDeck(req.dbUser!.id, deckId, cards)
    if (!inserted) {
      res.status(404).json({ error: 'Deck not found' })
      return
    }
    res.status(201).json({ cards: inserted })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.delete('/flashcards/cards/:id', async (req: AuthRequest, res: Response) => {
  try {
    const cardId = parsePositiveId(req.params.id)
    if (!cardId) {
      res.status(400).json({ error: 'Invalid card ID' })
      return
    }
    const ok = await deleteFlashcard(req.dbUser!.id, cardId)
    if (!ok) {
      res.status(404).json({ error: 'Flashcard not found' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    handleError(res, error)
  }
})

// ── Study Planner ────────────────────────────────────────────────────────────

dbRouter.get('/planner', async (req: AuthRequest, res: Response) => {
  try {
    const data = await listPlannerData(req.dbUser!.id)
    res.json(data)
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.post('/planner/exams', async (req: AuthRequest, res: Response) => {
  try {
    const subject = String(req.body?.subject || '').trim().slice(0, 120)
    const examDate = new Date(req.body?.examDate)
    const hoursNeeded = Math.max(1, Math.min(200, Number(req.body?.hoursNeeded) || 15))
    if (!subject || Number.isNaN(examDate.getTime())) {
      res.status(400).json({ error: 'Valid subject and exam date are required' })
      return
    }
    const exam = await createStudyExam(req.dbUser!.id, { subject, examDate, hoursNeeded })
    res.status(201).json({ exam })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.delete('/planner/exams/:id', async (req: AuthRequest, res: Response) => {
  try {
    const examId = parsePositiveId(req.params.id)
    if (!examId) {
      res.status(400).json({ error: 'Invalid exam ID' })
      return
    }
    const ok = await deleteStudyExam(req.dbUser!.id, examId)
    if (!ok) {
      res.status(404).json({ error: 'Exam not found' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.post('/planner/tasks', async (req: AuthRequest, res: Response) => {
  try {
    const rawTasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [req.body]
    const validTasks = rawTasks
      .filter((t: unknown) => Boolean(t && typeof (t as { subject?: unknown }).subject === 'string' && typeof (t as { topic?: unknown }).topic === 'string'))
      .slice(0, 20)
      .map((t: { subject: string; topic: string; taskDate?: string; duration?: number }) => {
        const d = t.taskDate ? new Date(t.taskDate) : new Date()
        return {
          subject: t.subject.trim().slice(0, 120),
          topic: t.topic.trim().slice(0, 200),
          taskDate: Number.isNaN(d.getTime()) ? new Date() : d,
          duration: Math.max(5, Math.min(480, Number(t.duration) || 60)),
        }
      })

    if (!validTasks.length) {
      res.status(400).json({ error: 'Subject and topic are required' })
      return
    }

    const tasks = await createStudyTasks(req.dbUser!.id, validTasks)
    res.status(201).json({ tasks })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.patch('/planner/tasks/:id', async (req: AuthRequest, res: Response) => {
  try {
    const taskId = parsePositiveId(req.params.id)
    if (!taskId) {
      res.status(400).json({ error: 'Invalid task ID' })
      return
    }
    const done = Boolean(req.body?.done)
    const task = await toggleStudyTask(req.dbUser!.id, taskId, done)
    if (!task) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    res.json({ task })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.delete('/planner/tasks/:id', async (req: AuthRequest, res: Response) => {
  try {
    const taskId = parsePositiveId(req.params.id)
    if (!taskId) {
      res.status(400).json({ error: 'Invalid task ID' })
      return
    }
    const ok = await deleteStudyTask(req.dbUser!.id, taskId)
    if (!ok) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    handleError(res, error)
  }
})

// ── Quiz Attempts ────────────────────────────────────────────────────────────

dbRouter.get('/quizzes/attempts', async (req: AuthRequest, res: Response) => {
  try {
    const attempts = await listQuizAttempts(req.dbUser!.id)
    res.json({ attempts })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.post('/quizzes/attempts', async (req: AuthRequest, res: Response) => {
  try {
    const subject = String(req.body?.subject || 'General').trim().slice(0, 120)
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim().slice(0, 180) : undefined
    const difficulty = String(req.body?.difficulty || 'medium').trim().slice(0, 30)
    const score = Math.max(0, Number(req.body?.score) || 0)
    const totalQuestions = Math.max(1, Number(req.body?.totalQuestions) || 1)

    const result = await recordQuizAttempt(req.dbUser!.id, {
      subject,
      topic,
      difficulty,
      score,
      totalQuestions,
    })
    res.status(201).json(result)
  } catch (error) {
    handleError(res, error)
  }
})

// Live Public Academic Question Bank (Open Trivia DB — no API key required)
const OPENTDB_CATEGORIES: Record<string, number> = {
  Mathematics: 19,
  'Computer Science': 18,
  Physics: 17,
  Chemistry: 17,
  Biology: 17,
  History: 23,
  Geography: 22,
  English: 10,
}

function decodeHtmlEntities(str: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    '#039': "'",
    ldquo: '"',
    rdquo: '"',
    lsquo: "'",
    rsquo: "'",
    ndash: '–',
    mdash: '—',
    hellip: '...',
    deg: '°',
    pi: 'π',
    times: '×',
    divide: '÷',
    minus: '−',
    plusmn: '±',
    radic: '√',
    infin: '∞',
    ne: '≠',
    le: '≤',
    ge: '≥',
    eacute: 'é',
    aacute: 'á',
    iacute: 'í',
    oacute: 'ó',
    uacute: 'ú',
    ntilde: 'ñ',
    uuml: 'ü',
  }
  return str.replace(/&([a-zA-Z0-9#]+);/g, (full, entity: string) => {
    if (entity in named) return named[entity]
    if (entity.startsWith('#x')) {
      const code = parseInt(entity.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : full
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : full
    }
    return full
  })
}

dbRouter.get('/quizzes/bank', async (req: AuthRequest, res: Response) => {
  try {
    const subject = String(req.query.subject || 'Computer Science').trim()
    const difficulty = String(req.query.difficulty || 'medium').trim()
    const qType = req.query.type === 'truefalse' ? 'boolean' : 'multiple'
    const count = Math.min(20, Math.max(1, Number(req.query.count) || 5))
    const category = OPENTDB_CATEGORIES[subject] ?? 17

    const fetchBank = async (params: Record<string, string>) => {
      const qs = new URLSearchParams(params).toString()
      const resp = await fetch(`https://opentdb.com/api.php?${qs}`)
      if (!resp.ok) throw new Error(`Question bank error (${resp.status})`)
      return (await resp.json()) as {
        response_code: number
        results?: Array<{
          category: string
          type: string
          difficulty: string
          question: string
          correct_answer: string
          incorrect_answers: string[]
        }>
      }
    }

    let data = await fetchBank({
      amount: String(count),
      category: String(category),
      difficulty: ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium',
      type: qType,
    })

    if ((data.response_code !== 0 || !data.results?.length)) {
      data = await fetchBank({
        amount: String(count),
        category: String(category),
        type: qType,
      })
    }

    if ((data.response_code !== 0 || !data.results?.length)) {
      data = await fetchBank({
        amount: String(count),
        category: String(category),
      })
    }

    if ((data.response_code !== 0 || !data.results?.length)) {
      data = await fetchBank({
        amount: String(count),
        type: qType,
      })
    }

    const rawResults = data.results || []
    if (!rawResults.length) {
      res.status(502).json({ error: 'Could not load questions for this filter. Try another count or subject.' })
      return
    }

    const questions = rawResults.map((item, idx) => {
      const correctAns = decodeHtmlEntities(item.correct_answer)
      const incorrect = item.incorrect_answers.map(decodeHtmlEntities)
      let options: string[]
      if (item.type === 'boolean') {
        options = ['True', 'False']
      } else {
        options = [...incorrect, correctAns]
        for (let i = options.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[options[i], options[j]] = [options[j], options[i]]
        }
      }
      const correctIdx = options.indexOf(correctAns)
      return {
        id: `bank-${Date.now()}-${idx}`,
        question: decodeHtmlEntities(item.question),
        options,
        correct: correctIdx >= 0 ? correctIdx : 0,
        explanation: `Category: ${decodeHtmlEntities(item.category)} (${item.difficulty}) • Correct answer: ${correctAns}`,
      }
    })

    res.json({ questions, source: 'Open Trivia DB' })
  } catch (error) {
    handleError(res, error, 'Failed to fetch live quiz questions')
  }
})

// YouTube oEmbed Metadata Lookup (no API key required)
dbRouter.get('/youtube/info', async (req: AuthRequest, res: Response) => {
  try {
    const rawUrl = String(req.query.url || '').trim()
    if (!rawUrl) {
      res.status(400).json({ error: 'YouTube URL is required' })
      return
    }

    let videoId = ''
    try {
      const parsed = new URL(rawUrl)
      if (parsed.hostname.includes('youtu.be')) {
        videoId = parsed.pathname.replace(/^\//, '').split('/')[0] || ''
      } else {
        videoId = parsed.searchParams.get('v') || ''
        if (!videoId && parsed.pathname.includes('/embed/')) {
          videoId = parsed.pathname.split('/embed/')[1]?.split('/')[0] || ''
        }
      }
    } catch {
      res.status(400).json({ error: 'Invalid YouTube URL' })
      return
    }

    if (!videoId) {
      res.status(400).json({ error: 'Could not find a YouTube video ID in that URL' })
      return
    }

    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`
    )
    if (!oembedRes.ok) {
      res.status(404).json({ error: 'Could not load video details from YouTube' })
      return
    }

    const meta = (await oembedRes.json()) as {
      title?: string
      author_name?: string
      thumbnail_url?: string
    }

    res.json({
      videoId,
      title: meta.title || 'YouTube Video',
      channel: meta.author_name || 'YouTube',
      thumbnailUrl: meta.thumbnail_url || '',
    })
  } catch (error) {
    handleError(res, error, 'Failed to load YouTube video info')
  }
})

// ── Chat Conversations ───────────────────────────────────────────────────────

dbRouter.get('/chats', async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await listChatConversations(req.dbUser!.id)
    res.json({ conversations })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.post('/chats', async (req: AuthRequest, res: Response) => {
  try {
    const title = String(req.body?.title || 'New conversation').trim().slice(0, 180)
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim().slice(0, 100) : undefined
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim().slice(0, 150) : undefined
    const conversation = await createChatConversation(req.dbUser!.id, { title, subject, topic })
    res.status(201).json({ conversation })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.patch('/chats/:id', async (req: AuthRequest, res: Response) => {
  try {
    const convId = parsePositiveId(req.params.id)
    if (!convId) {
      res.status(400).json({ error: 'Invalid conversation ID' })
      return
    }
    const title = String(req.body?.title || '').trim().slice(0, 180)
    if (!title) {
      res.status(400).json({ error: 'Title is required' })
      return
    }
    const conversation = await updateChatConversationTitle(req.dbUser!.id, convId, title)
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }
    res.json({ conversation })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.delete('/chats/:id', async (req: AuthRequest, res: Response) => {
  try {
    const convId = parsePositiveId(req.params.id)
    if (!convId) {
      res.status(400).json({ error: 'Invalid conversation ID' })
      return
    }
    const ok = await deleteChatConversation(req.dbUser!.id, convId)
    if (!ok) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.post('/chats/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const convId = parsePositiveId(req.params.id)
    if (!convId) {
      res.status(400).json({ error: 'Invalid conversation ID' })
      return
    }
    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : []
    const items = rawMessages
      .filter(
        (m: unknown): m is { role: 'user' | 'assistant'; content: string } =>
          Boolean(
            m &&
              ((m as { role?: unknown }).role === 'user' || (m as { role?: unknown }).role === 'assistant') &&
              typeof (m as { content?: unknown }).content === 'string'
          )
      )
      .slice(0, 10)

    if (!items.length) {
      res.status(400).json({ error: 'At least one message is required' })
      return
    }

    const messages = await appendChatMessages(req.dbUser!.id, convId, items)
    if (!messages) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }
    res.status(201).json({ messages })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.patch('/chats/messages/:id/like', async (req: AuthRequest, res: Response) => {
  try {
    const msgId = parsePositiveId(req.params.id)
    if (!msgId) {
      res.status(400).json({ error: 'Invalid message ID' })
      return
    }
    const liked = typeof req.body?.liked === 'boolean' ? req.body.liked : null
    const message = await updateChatMessageLike(req.dbUser!.id, msgId, liked)
    if (!message) {
      res.status(404).json({ error: 'Message not found' })
      return
    }
    res.json({ message })
  } catch (error) {
    handleError(res, error)
  }
})

// ── Attendance ───────────────────────────────────────────────────────────────

dbRouter.get('/attendance', async (req: AuthRequest, res: Response) => {
  try {
    const subjects = await listAttendanceSubjects(req.dbUser!.id)
    res.json({ subjects })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.post('/attendance', async (req: AuthRequest, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 120)
    if (!name) {
      res.status(400).json({ error: 'Subject name is required' })
      return
    }
    const required = Math.max(1, Math.min(100, Number(req.body?.required) || 75))
    const attended = Math.max(0, Number(req.body?.attended) || 0)
    const total = Math.max(attended, Number(req.body?.total) || 0)

    const subject = await createAttendanceSubject(req.dbUser!.id, {
      name,
      required,
      attended,
      total,
    })
    res.status(201).json({ subject })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.post('/attendance/:id/mark', async (req: AuthRequest, res: Response) => {
  try {
    const subjectId = parsePositiveId(req.params.id)
    if (!subjectId) {
      res.status(400).json({ error: 'Invalid subject ID' })
      return
    }
    const type = req.body?.type === 'absent' ? 'absent' : 'present'
    const subject = await markAttendanceSubject(req.dbUser!.id, subjectId, type)
    if (!subject) {
      res.status(404).json({ error: 'Subject not found' })
      return
    }
    res.json({ subject })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.delete('/attendance/:id', async (req: AuthRequest, res: Response) => {
  try {
    const subjectId = parsePositiveId(req.params.id)
    if (!subjectId) {
      res.status(400).json({ error: 'Invalid subject ID' })
      return
    }
    const ok = await deleteAttendanceSubject(req.dbUser!.id, subjectId)
    if (!ok) {
      res.status(404).json({ error: 'Subject not found' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    handleError(res, error)
  }
})

// ── CGPA ─────────────────────────────────────────────────────────────────────

dbRouter.get('/cgpa/semesters', async (req: AuthRequest, res: Response) => {
  try {
    const semesters = await listCgpaSemesters(req.dbUser!.id)
    res.json({ semesters })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.post('/cgpa/semesters', async (req: AuthRequest, res: Response) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : ''
    const semester = await createCgpaSemester(req.dbUser!.id, name)
    res.status(201).json({ semester })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.post('/cgpa/semesters/:id/courses', async (req: AuthRequest, res: Response) => {
  try {
    const semesterId = parsePositiveId(req.params.id)
    if (!semesterId) {
      res.status(400).json({ error: 'Invalid semester ID' })
      return
    }
    const name = String(req.body?.name || 'New Subject').trim().slice(0, 120)
    const credits = Math.max(1, Math.min(10, Number(req.body?.credits) || 3))
    const grade = String(req.body?.grade || 'A').trim().slice(0, 5)
    const course = await createCgpaCourse(req.dbUser!.id, semesterId, { name, credits, grade })
    if (!course) {
      res.status(404).json({ error: 'Semester not found' })
      return
    }
    res.status(201).json({ course })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.patch('/cgpa/courses/:id', async (req: AuthRequest, res: Response) => {
  try {
    const courseId = parsePositiveId(req.params.id)
    if (!courseId) {
      res.status(400).json({ error: 'Invalid course ID' })
      return
    }
    const updates: { name?: string; credits?: number; grade?: string } = {}
    if (typeof req.body?.name === 'string') updates.name = req.body.name.slice(0, 120)
    if (req.body?.credits !== undefined) {
      updates.credits = Math.max(1, Math.min(10, Number(req.body.credits) || 1))
    }
    if (typeof req.body?.grade === 'string') updates.grade = req.body.grade.slice(0, 5)

    const course = await updateCgpaCourse(req.dbUser!.id, courseId, updates)
    if (!course) {
      res.status(404).json({ error: 'Course not found' })
      return
    }
    res.json({ course })
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.delete('/cgpa/courses/:id', async (req: AuthRequest, res: Response) => {
  try {
    const courseId = parsePositiveId(req.params.id)
    if (!courseId) {
      res.status(400).json({ error: 'Invalid course ID' })
      return
    }
    const ok = await deleteCgpaCourse(req.dbUser!.id, courseId)
    if (!ok) {
      res.status(404).json({ error: 'Course not found' })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    handleError(res, error)
  }
})

// ── Pomodoro ─────────────────────────────────────────────────────────────────

dbRouter.get('/pomodoro', async (req: AuthRequest, res: Response) => {
  try {
    const stats = await listPomodoroStats(req.dbUser!.id)
    res.json(stats)
  } catch (error) {
    handleError(res, error)
  }
})

dbRouter.post('/pomodoro', async (req: AuthRequest, res: Response) => {
  try {
    const durationMinutes = Math.max(1, Math.min(180, Number(req.body?.durationMinutes) || 25))
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim().slice(0, 100) : undefined
    const session = await recordPomodoroSession(req.dbUser!.id, durationMinutes, subject)
    res.status(201).json({ session })
  } catch (error) {
    handleError(res, error)
  }
})
