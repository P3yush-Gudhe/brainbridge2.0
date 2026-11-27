import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'

vi.mock('../src/lib/firebase-admin.ts', () => ({
  adminAuth: {
    verifyIdToken: vi.fn(async (token: string) => {
      if (token === 'valid-test-token') {
        return {
          uid: 'test-uid-1',
          email: 'student@example.edu',
          name: 'Test Student',
        }
      }
      throw new Error('Invalid token')
    }),
  },
}))

vi.mock('../src/db/users.ts', () => ({
  getOrCreateUser: vi.fn(async () => ({
    id: 1,
    uid: 'test-uid-1',
    email: 'student@example.edu',
    name: 'Test Student',
    avatar: null,
    bio: '',
    university: '',
    year: '',
    xp: 120,
    level: 1,
    streak: 3,
    createdAt: new Date(),
  })),
  updateUserProfile: vi.fn(async (_id: number, updates: Record<string, unknown>) => ({
    id: 1,
    uid: 'test-uid-1',
    email: 'student@example.edu',
    name: updates.name || 'Test Student',
  })),
  deleteUserById: vi.fn(async () => true),
}))

vi.mock('../src/db/workspace.ts', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/db/workspace.ts')
  return {
    ...actual,
    listUserNotes: vi.fn(async (_userId: number, query?: string, tag?: string) => [
      { id: 10, title: query ? `Match: ${query}` : 'Sample Note', content: 'Body', tags: tag ? [tag] : ['math'] },
    ]),
    createUserNote: vi.fn(async (_userId: number, data: { title: string; content: string; tags: string[] }) => ({
      id: 11,
      ...data,
    })),
    reviewFlashcard: vi.fn(async (_userId: number, cardId: number, difficulty: string) => ({
      id: cardId,
      difficulty,
      easeFactor: difficulty === 'again' ? 218 : 260,
      intervalDays: difficulty === 'again' ? 0 : 4,
      repetitions: difficulty === 'again' ? 0 : 1,
    })),
    toggleDeckShare: vi.fn(async (_userId: number, deckId: number, isPublic: boolean) => ({
      id: deckId,
      name: 'Shared Biology',
      subject: 'Biology',
      shareCode: 'ABC12345',
      isPublic,
      cards: [],
      createdAt: new Date(),
    })),
    importDeckByShareCode: vi.fn(async (_userId: number, shareCode: string) =>
      shareCode === 'ABC12345'
        ? { id: 99, name: 'Shared Biology', subject: 'Biology', shareCode: null, isPublic: false, cards: [], createdAt: new Date() }
        : null
    ),
    updateStudyTask: vi.fn(async (_userId: number, taskId: number, updates: Record<string, unknown>) => ({
      id: taskId,
      subject: 'Math',
      topic: 'Linear Algebra',
      taskDate: updates.taskDate ?? new Date(),
      duration: updates.duration ?? 60,
      done: updates.done ?? false,
    })),
    listQuizAttempts: vi.fn(async () => [
      {
        id: 1,
        subject: 'Physics',
        topic: 'Optics',
        difficulty: 'medium',
        score: 2,
        totalQuestions: 5,
        missedQuestions: [
          { question: 'Snell law?', options: ['A', 'B'], correct: 0, selected: 1, explanation: 'n1 sin1 = n2 sin2' },
        ],
        createdAt: new Date(),
      },
    ]),
  }
})

import { createApiApp } from '../server/app.ts'

describe('Express API security, validation, and Phase 4 routes', () => {
  const app = createApiApp({ enableRateLimit: false })

  it('serves /api/health with security headers', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('returns JSON 404 for unknown /api/* routes', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.body.error).toBe('API route not found')
  })

  it('blocks unauthenticated workspace and AI requests with 401', async () => {
    const res = await request(app).get('/api/notes')
    expect(res.status).toBe(401)
    expect(res.body.error).toContain('Unauthorized')

    const aiRes = await request(app).post('/api/ai/quiz').send({ subject: 'Math' })
    expect(aiRes.status).toBe(401)

    const weeklyRes = await request(app).post('/api/ai/weekly-summary')
    expect(weeklyRes.status).toBe(401)
  })

  it('returns authenticated user notes with FTS query and tag parameters', async () => {
    const res = await request(app)
      .get('/api/notes?q=calculus&tag=math')
      .set('Authorization', 'Bearer valid-test-token')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.notes)).toBe(true)
    expect(res.body.notes[0].title).toBe('Match: calculus')
    expect(res.body.notes[0].tags).toContain('math')
  })

  it('supports SM-2 flashcard review ratings including again', async () => {
    const res = await request(app)
      .patch('/api/flashcards/cards/42/review')
      .set('Authorization', 'Bearer valid-test-token')
      .send({ difficulty: 'again' })
    expect(res.status).toBe(200)
    expect(res.body.card.intervalDays).toBe(0)
    expect(res.body.card.repetitions).toBe(0)
  })

  it('supports sharing and importing flashcard decks by shareCode', async () => {
    const shareRes = await request(app)
      .post('/api/flashcards/decks/5/share')
      .set('Authorization', 'Bearer valid-test-token')
      .send({ isPublic: true })
    expect(shareRes.status).toBe(200)
    expect(shareRes.body.deck.shareCode).toBe('ABC12345')

    const importOk = await request(app)
      .post('/api/flashcards/import/ABC12345')
      .set('Authorization', 'Bearer valid-test-token')
    expect(importOk.status).toBe(201)
    expect(importOk.body.deck.id).toBe(99)

    const importMissing = await request(app)
      .post('/api/flashcards/import/UNKNOWN9')
      .set('Authorization', 'Bearer valid-test-token')
    expect(importMissing.status).toBe(404)
  })

  it('supports rescheduling study tasks by taskDate', async () => {
    const res = await request(app)
      .patch('/api/planner/tasks/12')
      .set('Authorization', 'Bearer valid-test-token')
      .send({ taskDate: '2026-06-15T12:00:00.000Z' })
    expect(res.status).toBe(200)
    expect(res.body.task.id).toBe(12)
  })

  it('returns quiz attempts alongside computed weakTopics', async () => {
    const res = await request(app)
      .get('/api/quizzes/attempts')
      .set('Authorization', 'Bearer valid-test-token')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.attempts)).toBe(true)
    expect(Array.isArray(res.body.weakTopics)).toBe(true)
    expect(res.body.weakTopics[0].subject).toBe('Physics')
    expect(res.body.weakTopics[0].avgScorePct).toBe(40)
    expect(res.body.weakTopics[0].missedQuestions.length).toBe(1)
  })

  it('enforces Zod validation with 400 on invalid payloads', async () => {
    const badSettings = await request(app)
      .patch('/api/settings')
      .set('Authorization', 'Bearer valid-test-token')
      .send({ dailyGoalMinutes: 99999, theme: 'neon-invalid' })
    expect(badSettings.status).toBe(400)
    expect(badSettings.body.error).toBe('Invalid request body')

    const badQuiz = await request(app)
      .post('/api/ai/quiz')
      .set('Authorization', 'Bearer valid-test-token')
      .send({ count: 99, difficulty: 'impossible' })
    expect(badQuiz.status).toBe(400)
    expect(badQuiz.body.error).toBe('Invalid request body')
  })

  it('rejects oversized >1MB JSON payloads on non-upload routes with 413', async () => {
    const bigString = 'a'.repeat(1_200_000)
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', 'Bearer valid-test-token')
      .send({ title: 'Too Large', content: bigString })
    expect(res.status).toBe(413)
    expect(res.body.error).toContain('/api/uploads')
  })

  it('rejects disallowed CORS origins cleanly', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil-attacker.example.com')
    expect(res.status).toBe(403)
    expect(res.body.error).toContain('CORS')
  })
})
