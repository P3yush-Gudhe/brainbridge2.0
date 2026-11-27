import { relations } from 'drizzle-orm'
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull().default('Student'),
  avatar: text('avatar'),
  bio: text('bio').notNull().default(''),
  university: text('university').notNull().default(''),
  year: text('year').notNull().default(''),
  streak: integer('streak').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const notes = pgTable('notes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const flashcardDecks = pgTable('flashcard_decks', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  subject: text('subject').notNull().default('General'),
  shareCode: text('share_code'),
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const flashcards = pgTable('flashcards', {
  id: serial('id').primaryKey(),
  deckId: integer('deck_id')
    .references(() => flashcardDecks.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  front: text('front').notNull(),
  back: text('back').notNull(),
  difficulty: text('difficulty'),
  reviewCount: integer('review_count').notNull().default(0),
  easeFactor: integer('ease_factor').notNull().default(250),
  intervalDays: integer('interval_days').notNull().default(0),
  repetitions: integer('repetitions').notNull().default(0),
  lastReviewedAt: timestamp('last_reviewed_at'),
  dueDate: timestamp('due_date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const studyExams = pgTable('study_exams', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  subject: text('subject').notNull(),
  examDate: timestamp('exam_date').notNull(),
  hoursNeeded: integer('hours_needed').notNull().default(15),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const studyTasks = pgTable('study_tasks', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  subject: text('subject').notNull(),
  topic: text('topic').notNull(),
  taskDate: timestamp('task_date').notNull(),
  duration: integer('duration').notNull().default(60),
  done: boolean('done').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export interface MissedQuizQuestionRecord {
  question: string
  options: string[]
  correct: number
  selected: number
  explanation?: string
  topic?: string
}

export const quizAttempts = pgTable('quiz_attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  subject: text('subject').notNull(),
  topic: text('topic'),
  difficulty: text('difficulty').notNull(),
  score: integer('score').notNull(),
  totalQuestions: integer('total_questions').notNull(),
  missedQuestions: jsonb('missed_questions').$type<MissedQuizQuestionRecord[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const chatConversations = pgTable('chat_conversations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  subject: text('subject'),
  topic: text('topic'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id')
    .references(() => chatConversations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  liked: boolean('liked'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const attendanceSubjects = pgTable('attendance_subjects', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  required: integer('required').notNull().default(75),
  attended: integer('attended').notNull().default(0),
  total: integer('total').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const cgpaSemesters = pgTable('cgpa_semesters', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const cgpaCourses = pgTable('cgpa_courses', {
  id: serial('id').primaryKey(),
  semesterId: integer('semester_id')
    .references(() => cgpaSemesters.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  credits: integer('credits').notNull().default(3),
  grade: text('grade').notNull().default('A'),
})

export const pomodoroSessions = pgTable('pomodoro_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  subject: text('subject'),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
})

export interface PdfHighlightRecord {
  id: string
  page: number
  text: string
  color: string
  createdAt: string
}

export const savedPdfs = pgTable('saved_pdfs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  fileName: text('file_name').notNull(),
  pageCount: integer('page_count').notNull().default(1),
  extractedText: text('extracted_text').notNull().default(''),
  summary: text('summary').notNull().default(''),
  keyPoints: jsonb('key_points').$type<string[]>().notNull().default([]),
  highlights: jsonb('highlights').$type<PdfHighlightRecord[]>().notNull().default([]),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export interface MindMapBranchRecord {
  title: string
  children: string[]
}

export const mindMaps = pgTable('mind_maps', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  root: text('root').notNull(),
  branches: jsonb('branches').$type<MindMapBranchRecord[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const xpEvents = pgTable('xp_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  source: text('source').notNull(),
  points: integer('points').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const userAchievements = pgTable('user_achievements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  achievementKey: text('achievement_key').notNull(),
  title: text('title').notNull(),
  xpReward: integer('xp_reward').notNull().default(50),
  unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
})

export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  theme: text('theme').notNull().default('system'),
  examReminders: boolean('exam_reminders').notNull().default(true),
  streakAlerts: boolean('streak_alerts').notNull().default(true),
  weeklySummary: boolean('weekly_summary').notNull().default(true),
  leaderboardVisible: boolean('leaderboard_visible').notNull().default(false),
  dailyGoalMinutes: integer('daily_goal_minutes').notNull().default(60),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const usersRelations = relations(users, ({ one, many }) => ({
  notes: many(notes),
  flashcardDecks: many(flashcardDecks),
  studyExams: many(studyExams),
  studyTasks: many(studyTasks),
  quizAttempts: many(quizAttempts),
  chatConversations: many(chatConversations),
  attendanceSubjects: many(attendanceSubjects),
  cgpaSemesters: many(cgpaSemesters),
  pomodoroSessions: many(pomodoroSessions),
  savedPdfs: many(savedPdfs),
  mindMaps: many(mindMaps),
  xpEvents: many(xpEvents),
  userAchievements: many(userAchievements),
  settings: one(userSettings),
}))

export const notesRelations = relations(notes, ({ one }) => ({
  author: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
}))

export const flashcardDecksRelations = relations(flashcardDecks, ({ one, many }) => ({
  owner: one(users, {
    fields: [flashcardDecks.userId],
    references: [users.id],
  }),
  cards: many(flashcards),
}))

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  deck: one(flashcardDecks, {
    fields: [flashcards.deckId],
    references: [flashcardDecks.id],
  }),
  owner: one(users, {
    fields: [flashcards.userId],
    references: [users.id],
  }),
}))

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  owner: one(users, {
    fields: [chatConversations.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}))

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
}))

export const cgpaSemestersRelations = relations(cgpaSemesters, ({ one, many }) => ({
  owner: one(users, {
    fields: [cgpaSemesters.userId],
    references: [users.id],
  }),
  courses: many(cgpaCourses),
}))

export const cgpaCoursesRelations = relations(cgpaCourses, ({ one }) => ({
  semester: one(cgpaSemesters, {
    fields: [cgpaCourses.semesterId],
    references: [cgpaSemesters.id],
  }),
}))
