import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {})
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: result.error.flatten().fieldErrors,
      })
      return
    }
    req.body = result.data
    next()
  }
}

// ── Account & Settings Schemas ───────────────────────────────────────────────

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    bio: z.string().trim().max(500).optional(),
    university: z.string().trim().max(150).optional(),
    year: z.string().trim().max(60).optional(),
  })
  .strict()

export const updateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  examReminders: z.boolean().optional(),
  streakAlerts: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
  leaderboardVisible: z.boolean().optional(),
  dailyGoalMinutes: z.coerce.number().int().min(15).max(480).optional(),
})

// ── Saved PDFs & Mind Maps Schemas ───────────────────────────────────────────

const pdfHighlightSchema = z.object({
  id: z.string().trim().min(1).max(80),
  page: z.coerce.number().int().min(1).max(2000),
  text: z.string().trim().min(1).max(2000),
  color: z.string().trim().min(1).max(30),
  createdAt: z.string().trim().max(60),
})

export const createPdfSchema = z.object({
  fileName: z.string().trim().min(1, 'PDF file name is required').max(200),
  pageCount: z.coerce.number().int().min(1).max(2000).default(1),
  extractedText: z.string().max(200000).default(''),
  summary: z.string().max(60000).default(''),
  keyPoints: z.array(z.string().max(1000)).max(30).default([]),
  highlights: z.array(pdfHighlightSchema).max(100).default([]),
  notes: z.string().max(30000).default(''),
})

export const updatePdfSchema = z.object({
  summary: z.string().max(60000).optional(),
  keyPoints: z.array(z.string().max(1000)).max(30).optional(),
  highlights: z.array(pdfHighlightSchema).max(100).optional(),
  notes: z.string().max(30000).optional(),
})

const mindMapBranchSchema = z.object({
  title: z.string().trim().min(1).max(120),
  children: z.array(z.string().trim().max(160)).max(20).default([]),
})

export const createMindMapSchema = z.object({
  title: z.string().trim().max(180).optional(),
  root: z.string().trim().min(1, 'Mind map root topic is required').max(160),
  branches: z.array(mindMapBranchSchema).max(20).default([]),
})

export const updateMindMapSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  root: z.string().trim().min(1).max(160).optional(),
  branches: z.array(mindMapBranchSchema).max(20).optional(),
})

// ── Notes Schemas ────────────────────────────────────────────────────────────

export const createNoteSchema = z.object({
  title: z.string().trim().max(200).default('Untitled Note'),
  content: z.string().max(200000).default(''),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
})

export const updateNoteSchema = z.object({
  title: z.string().trim().max(200).optional(),
  content: z.string().max(200000).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
})

// ── Flashcards Schemas ───────────────────────────────────────────────────────

const cardInputSchema = z.object({
  front: z.string().trim().min(1).max(500),
  back: z.string().trim().min(1).max(1000),
})

export const createDeckSchema = z.object({
  name: z.string().trim().min(1, 'Deck name is required').max(150),
  subject: z.string().trim().max(100).default('General'),
  cards: z.array(cardInputSchema).max(50).default([]),
})

export const addCardsSchema = z
  .object({
    cards: z.array(cardInputSchema).max(50).optional(),
    front: z.string().trim().min(1).max(500).optional(),
    back: z.string().trim().min(1).max(1000).optional(),
  })
  .refine(
    (d) => (d.cards && d.cards.length > 0) || Boolean(d.front && d.back),
    { message: 'Card front and back text are required' }
  )

export const reviewCardSchema = z.object({
  difficulty: z.enum(['again', 'hard', 'medium', 'easy']),
})

export const shareDeckSchema = z.object({
  isPublic: z.boolean().default(true),
})

// ── Study Planner & Quizzes Schemas ──────────────────────────────────────────

export const createExamSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(120),
  examDate: z.string().trim().min(1, 'Exam date is required'),
  hoursNeeded: z.coerce.number().int().min(1).max(200).default(15),
})

const singleTaskSchema = z.object({
  subject: z.string().trim().min(1).max(120),
  topic: z.string().trim().min(1).max(200),
  taskDate: z.string().optional(),
  duration: z.coerce.number().int().min(5).max(480).default(60),
})

export const createTasksSchema = z.union([
  z.object({
    tasks: z.array(singleTaskSchema).min(1).max(20),
  }),
  singleTaskSchema,
])

export const updateTaskSchema = z.object({
  done: z.boolean().optional(),
  taskDate: z.string().optional(),
  duration: z.coerce.number().int().min(5).max(480).optional(),
})

export const recordQuizAttemptSchema = z.object({
  subject: z.string().trim().max(120).default('General'),
  topic: z.string().trim().max(180).optional(),
  difficulty: z.string().trim().max(30).default('medium'),
  score: z.coerce.number().int().min(0).max(200),
  totalQuestions: z.coerce.number().int().min(1).max(200),
  missedQuestions: z
    .array(
      z.object({
        question: z.string().max(1000),
        options: z.array(z.string().max(500)).min(2).max(6),
        correct: z.coerce.number().int().min(0).max(5),
        selected: z.coerce.number().int().min(-1).max(5),
        explanation: z.string().max(1000).default(''),
      })
    )
    .max(50)
    .optional(),
})

// ── Chat, Attendance, CGPA, Pomodoro Schemas ─────────────────────────────────

export const createChatSchema = z.object({
  title: z.string().trim().max(180).default('New conversation'),
  subject: z.string().trim().max(100).optional(),
  topic: z.string().trim().max(150).optional(),
})

export const renameChatSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(180),
})

export const appendChatMessagesSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(50000),
      })
    )
    .min(1, 'At least one message is required')
    .max(10),
})

export const likeChatMessageSchema = z.object({
  liked: z.boolean().nullable(),
})

export const createAttendanceSchema = z.object({
  name: z.string().trim().min(1, 'Subject name is required').max(120),
  required: z.coerce.number().int().min(1).max(100).default(75),
  attended: z.coerce.number().int().min(0).max(5000).default(0),
  total: z.coerce.number().int().min(0).max(5000).default(0),
})

export const markAttendanceSchema = z.object({
  type: z.enum(['present', 'absent']).default('present'),
})

export const createSemesterSchema = z.object({
  name: z.string().trim().max(80).default(''),
})

export const createCourseSchema = z.object({
  name: z.string().trim().max(120).default('New Subject'),
  credits: z.coerce.number().int().min(1).max(10).default(3),
  grade: z.string().trim().max(5).default('A'),
})

export const updateCourseSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  credits: z.coerce.number().int().min(1).max(10).optional(),
  grade: z.string().trim().min(1).max(5).optional(),
})

export const recordPomodoroSchema = z.object({
  durationMinutes: z.coerce.number().int().min(1).max(180).default(25),
  subject: z.string().trim().max(100).optional(),
})

// ── AI & Upload Schemas ──────────────────────────────────────────────────────

export const aiQuizSchema = z.object({
  subject: z.string().trim().min(1).max(120).default('General Knowledge'),
  topic: z.string().trim().max(200).optional(),
  sourceText: z.string().max(30000).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  type: z.enum(['mcq', 'truefalse']).default('mcq'),
  count: z.coerce.number().int().min(1).max(20).default(5),
})

export const aiChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(40000),
      })
    )
    .max(50)
    .default([]),
  prompt: z.string().trim().max(40000).optional(),
  subject: z.string().trim().max(120).optional(),
  topic: z.string().trim().max(180).optional(),
  stream: z.boolean().default(true),
  concise: z.boolean().default(false),
})

export const aiFlashcardsSchema = z
  .object({
    topic: z.string().trim().max(200).default(''),
    subject: z.string().trim().max(120).default('General'),
    sourceText: z.string().max(30000).default(''),
    count: z.coerce.number().int().min(3).max(20).default(8),
  })
  .refine((d) => Boolean(d.topic.trim() || d.sourceText.trim()), {
    message: 'Please provide a topic or study material to generate flashcards.',
  })

export const aiPdfSchema = z
  .object({
    action: z.enum(['process', 'chat']).default('process'),
    fileName: z.string().trim().max(200).default('document.pdf'),
    fileBase64: z.string().max(26_000_000).optional(),
    extractedText: z.string().max(300000).optional(),
    question: z.string().trim().max(4000).optional(),
  })
  .refine((d) => Boolean(d.fileBase64?.trim() || d.extractedText?.trim()), {
    message: 'PDF content is required.',
  })

export const aiYoutubeSchema = z.object({
  url: z.string().trim().min(1, 'Please provide a YouTube video URL.').max(500),
})

export const aiOcrSchema = z.object({
  action: z.enum(['extract', 'summarize', 'translate', 'notes']).default('extract'),
  imageBase64: z.string().max(20_000_000).optional(),
  mimeType: z.string().trim().max(60).default('image/png'),
  text: z.string().max(80000).optional(),
  targetLanguage: z.string().trim().max(60).default('Spanish'),
})

export const aiNotesSchema = z.object({
  action: z.enum(['generate', 'improve', 'translate', 'summarize']).default('summarize'),
  title: z.string().trim().max(200).default('Untitled Note'),
  content: z.string().max(120000).default(''),
  targetLanguage: z.string().trim().max(60).default('Spanish'),
})

export const aiMindMapSchema = z.object({
  topic: z.string().trim().min(1, 'Please enter a topic to generate a mind map.').max(200),
})

export const aiCodeSchema = z.object({
  action: z.enum(['run', 'explain', 'debug', 'optimize']).default('run'),
  language: z.enum(['python', 'javascript', 'cpp', 'c', 'java', 'typescript']).default('python'),
  code: z.string().min(1, 'Please write some code first.').max(50000),
})

export const aiPlannerSchema = z.object({
  exams: z
    .array(
      z.object({
        subject: z.string().max(120),
        date: z.string().max(60),
        hoursNeeded: z.coerce.number().min(1).max(300).optional(),
      })
    )
    .max(30)
    .default([]),
  existingTasks: z
    .array(
      z.object({
        subject: z.string().max(120),
        topic: z.string().max(200),
        done: z.boolean().optional(),
      })
    )
    .max(100)
    .default([]),
})
