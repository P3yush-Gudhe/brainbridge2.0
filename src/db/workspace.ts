import crypto from 'node:crypto'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from './index.ts'
import { calculateSm2, type Sm2Rating } from '../lib/sm2.ts'
import {
  attendanceSubjects,
  cgpaCourses,
  cgpaSemesters,
  chatConversations,
  chatMessages,
  flashcardDecks,
  flashcards,
  mindMaps,
  notes,
  pomodoroSessions,
  quizAttempts,
  savedPdfs,
  studyExams,
  studyTasks,
  userAchievements,
  userSettings,
  users,
  xpEvents,
  type MindMapBranchRecord,
  type MissedQuizQuestionRecord,
  type PdfHighlightRecord,
} from './schema.ts'

function dbErr(context: string, error: unknown): Error {
  console.error(`Database error (${context}):`, error)
  return new Error(`Failed to ${context}. Please try again later.`, { cause: error })
}

// ── Notes ────────────────────────────────────────────────────────────────────

export async function syncUserStreak(userId: number): Promise<number> {
  try {
    const [pomodoros, quizzes, doneTasks] = await Promise.all([
      db
        .select({ dt: pomodoroSessions.completedAt })
        .from(pomodoroSessions)
        .where(eq(pomodoroSessions.userId, userId))
        .limit(365),
      db
        .select({ dt: quizAttempts.createdAt })
        .from(quizAttempts)
        .where(eq(quizAttempts.userId, userId))
        .limit(365),
      db
        .select({ dt: studyTasks.taskDate })
        .from(studyTasks)
        .where(and(eq(studyTasks.userId, userId), eq(studyTasks.done, true)))
        .limit(365),
    ])

    const activeDays = new Set<string>()
    for (const row of pomodoros) activeDays.add(row.dt.toISOString().slice(0, 10))
    for (const row of quizzes) activeDays.add(row.dt.toISOString().slice(0, 10))
    for (const row of doneTasks) activeDays.add(row.dt.toISOString().slice(0, 10))

    let streak = 0
    const cursor = new Date()
    const todayKey = cursor.toISOString().slice(0, 10)
    if (!activeDays.has(todayKey)) {
      cursor.setDate(cursor.getDate() - 1)
    }

    while (streak < 365) {
      const key = cursor.toISOString().slice(0, 10)
      if (!activeDays.has(key)) break
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }

    const finalStreak = Math.max(1, streak)
    await db
      .update(users)
      .set({ streak: finalStreak, updatedAt: new Date() })
      .where(eq(users.id, userId))

    return finalStreak
  } catch (error) {
    console.error('Streak sync error:', error)
    return 1
  }
}

export async function listUserNotes(userId: number, query?: string, tag?: string) {
  try {
    const cleanQ = query?.trim()
    const cleanTag = tag?.trim().toLowerCase()

    const rows = await db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          cleanQ
            ? or(
                sql`to_tsvector('english', coalesce(${notes.title}, '') || ' ' || coalesce(${notes.content}, '')) @@ plainto_tsquery('english', ${cleanQ})`,
                ilike(notes.title, `%${cleanQ}%`),
                ilike(notes.content, `%${cleanQ}%`)
              )
            : undefined
        )
      )
      .orderBy(desc(notes.updatedAt))

    if (!cleanTag) return rows
    return rows.filter((n) =>
      Array.isArray(n.tags) && n.tags.some((t) => t.toLowerCase() === cleanTag)
    )
  } catch (error) {
    throw dbErr('load notes', error)
  }
}

export async function createUserNote(
  userId: number,
  data: { title: string; content: string; tags: string[] }
) {
  try {
    const [created] = await db
      .insert(notes)
      .values({
        userId,
        title: data.title,
        content: data.content,
        tags: data.tags,
      })
      .returning()
    return created
  } catch (error) {
    throw dbErr('create note', error)
  }
}

export async function updateUserNote(
  userId: number,
  noteId: number,
  updates: { title?: string; content?: string; tags?: string[] }
) {
  try {
    const [updated] = await db
      .update(notes)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .returning()
    return updated ?? null
  } catch (error) {
    throw dbErr('update note', error)
  }
}

export async function deleteUserNote(userId: number, noteId: number) {
  try {
    const deleted = await db
      .delete(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .returning({ id: notes.id })
    return deleted.length > 0
  } catch (error) {
    throw dbErr('delete note', error)
  }
}

// ── Flashcards ───────────────────────────────────────────────────────────────

export async function listUserDecks(userId: number) {
  try {
    const decks = await db
      .select()
      .from(flashcardDecks)
      .where(eq(flashcardDecks.userId, userId))
      .orderBy(desc(flashcardDecks.createdAt))

    const allCards = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.userId, userId))
      .orderBy(flashcards.id)

    const cardsByDeck = new Map<number, typeof allCards>()
    for (const card of allCards) {
      const list = cardsByDeck.get(card.deckId) ?? []
      list.push(card)
      cardsByDeck.set(card.deckId, list)
    }

    return decks.map((deck) => ({
      ...deck,
      cards: cardsByDeck.get(deck.id) ?? [],
    }))
  } catch (error) {
    throw dbErr('load flashcard decks', error)
  }
}

export async function createUserDeck(
  userId: number,
  data: {
    name: string
    subject: string
    cards?: Array<{ front: string; back: string }>
  }
) {
  try {
    const [deck] = await db
      .insert(flashcardDecks)
      .values({
        userId,
        name: data.name,
        subject: data.subject || 'General',
      })
      .returning()

    let insertedCards: Array<typeof flashcards.$inferSelect> = []
    if (data.cards && data.cards.length > 0) {
      insertedCards = await db
        .insert(flashcards)
        .values(
          data.cards.map((c) => ({
            deckId: deck.id,
            userId,
            front: c.front,
            back: c.back,
          }))
        )
        .returning()
    }

    return { ...deck, cards: insertedCards }
  } catch (error) {
    throw dbErr('create flashcard deck', error)
  }
}

export async function reviewFlashcard(
  userId: number,
  cardId: number,
  difficulty: Sm2Rating
) {
  try {
    const [existing] = await db
      .select()
      .from(flashcards)
      .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)))
      .limit(1)

    if (!existing) return null

    const sm2 = calculateSm2(
      {
        easeFactor: existing.easeFactor,
        intervalDays: existing.intervalDays,
        repetitions: existing.repetitions,
      },
      difficulty
    )

    const [updated] = await db
      .update(flashcards)
      .set({
        difficulty,
        dueDate: sm2.dueDate,
        easeFactor: sm2.easeFactor,
        intervalDays: sm2.intervalDays,
        repetitions: sm2.repetitions,
        lastReviewedAt: new Date(),
        reviewCount: sql`${flashcards.reviewCount} + 1`,
      })
      .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)))
      .returning()

    return updated ?? null
  } catch (error) {
    throw dbErr('update flashcard review', error)
  }
}

export async function toggleDeckShare(userId: number, deckId: number, isPublic: boolean) {
  try {
    const [existing] = await db
      .select()
      .from(flashcardDecks)
      .where(and(eq(flashcardDecks.id, deckId), eq(flashcardDecks.userId, userId)))
      .limit(1)
    if (!existing) return null

    const shareCode = existing.shareCode || crypto.randomBytes(4).toString('hex').toUpperCase()
    const [updated] = await db
      .update(flashcardDecks)
      .set({ isPublic, shareCode })
      .where(and(eq(flashcardDecks.id, deckId), eq(flashcardDecks.userId, userId)))
      .returning()

    return updated ?? null
  } catch (error) {
    throw dbErr('update deck sharing', error)
  }
}

export async function importDeckByShareCode(userId: number, rawCode: string) {
  try {
    const code = rawCode.trim().toUpperCase()
    if (!code) return null

    const [sourceDeck] = await db
      .select()
      .from(flashcardDecks)
      .where(and(eq(flashcardDecks.shareCode, code), eq(flashcardDecks.isPublic, true)))
      .limit(1)

    if (!sourceDeck) return null

    const sourceCards = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.deckId, sourceDeck.id))
      .orderBy(flashcards.id)

    const [createdDeck] = await db
      .insert(flashcardDecks)
      .values({
        userId,
        name: sourceDeck.name,
        subject: sourceDeck.subject,
        isPublic: false,
      })
      .returning()

    let insertedCards: Array<typeof flashcards.$inferSelect> = []
    if (sourceCards.length > 0) {
      insertedCards = await db
        .insert(flashcards)
        .values(
          sourceCards.map((c) => ({
            deckId: createdDeck.id,
            userId,
            front: c.front,
            back: c.back,
          }))
        )
        .returning()
    }

    return { ...createdDeck, cards: insertedCards }
  } catch (error) {
    throw dbErr('import shared deck', error)
  }
}

export async function deleteUserDeck(userId: number, deckId: number) {
  try {
    const deleted = await db
      .delete(flashcardDecks)
      .where(and(eq(flashcardDecks.id, deckId), eq(flashcardDecks.userId, userId)))
      .returning({ id: flashcardDecks.id })
    return deleted.length > 0
  } catch (error) {
    throw dbErr('delete flashcard deck', error)
  }
}

export async function addCardsToDeck(
  userId: number,
  deckId: number,
  cards: Array<{ front: string; back: string }>
) {
  try {
    const [deck] = await db
      .select({ id: flashcardDecks.id })
      .from(flashcardDecks)
      .where(and(eq(flashcardDecks.id, deckId), eq(flashcardDecks.userId, userId)))
      .limit(1)
    if (!deck) return null

    if (!cards.length) return []
    return await db
      .insert(flashcards)
      .values(
        cards.map((c) => ({
          deckId,
          userId,
          front: c.front,
          back: c.back,
        }))
      )
      .returning()
  } catch (error) {
    throw dbErr('add flashcards', error)
  }
}

export async function deleteFlashcard(userId: number, cardId: number) {
  try {
    const deleted = await db
      .delete(flashcards)
      .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)))
      .returning({ id: flashcards.id })
    return deleted.length > 0
  } catch (error) {
    throw dbErr('delete flashcard', error)
  }
}

// ── Study Planner (Exams & Tasks) ────────────────────────────────────────────

export async function listPlannerData(userId: number) {
  try {
    const [exams, tasks] = await Promise.all([
      db
        .select()
        .from(studyExams)
        .where(eq(studyExams.userId, userId))
        .orderBy(studyExams.examDate),
      db
        .select()
        .from(studyTasks)
        .where(eq(studyTasks.userId, userId))
        .orderBy(studyTasks.taskDate, desc(studyTasks.id)),
    ])
    return { exams, tasks }
  } catch (error) {
    throw dbErr('load study planner', error)
  }
}

export async function createStudyExam(
  userId: number,
  data: { subject: string; examDate: Date; hoursNeeded: number }
) {
  try {
    const [exam] = await db
      .insert(studyExams)
      .values({
        userId,
        subject: data.subject,
        examDate: data.examDate,
        hoursNeeded: data.hoursNeeded,
      })
      .returning()
    return exam
  } catch (error) {
    throw dbErr('create exam', error)
  }
}

export async function deleteStudyExam(userId: number, examId: number) {
  try {
    const deleted = await db
      .delete(studyExams)
      .where(and(eq(studyExams.id, examId), eq(studyExams.userId, userId)))
      .returning({ id: studyExams.id })
    return deleted.length > 0
  } catch (error) {
    throw dbErr('delete exam', error)
  }
}

export async function createStudyTasks(
  userId: number,
  items: Array<{ subject: string; topic: string; taskDate: Date; duration: number }>
) {
  try {
    if (!items.length) return []
    return await db
      .insert(studyTasks)
      .values(
        items.map((item) => ({
          userId,
          subject: item.subject,
          topic: item.topic,
          taskDate: item.taskDate,
          duration: item.duration,
          done: false,
        }))
      )
      .returning()
  } catch (error) {
    throw dbErr('create study tasks', error)
  }
}

export async function updateStudyTask(
  userId: number,
  taskId: number,
  updates: { done?: boolean; taskDate?: Date; duration?: number }
) {
  try {
    const setFields: { done?: boolean; taskDate?: Date; duration?: number } = {}
    if (typeof updates.done === 'boolean') setFields.done = updates.done
    if (updates.taskDate instanceof Date && !Number.isNaN(updates.taskDate.getTime())) {
      setFields.taskDate = updates.taskDate
    }
    if (typeof updates.duration === 'number' && Number.isFinite(updates.duration)) {
      setFields.duration = updates.duration
    }

    const [updated] = await db
      .update(studyTasks)
      .set(setFields)
      .where(and(eq(studyTasks.id, taskId), eq(studyTasks.userId, userId)))
      .returning()

    if (updated && updates.done === true) {
      await syncUserStreak(userId)
    }

    return updated ?? null
  } catch (error) {
    throw dbErr('update study task', error)
  }
}

export async function deleteStudyTask(userId: number, taskId: number) {
  try {
    const deleted = await db
      .delete(studyTasks)
      .where(and(eq(studyTasks.id, taskId), eq(studyTasks.userId, userId)))
      .returning({ id: studyTasks.id })
    return deleted.length > 0
  } catch (error) {
    throw dbErr('delete study task', error)
  }
}

// ── Quiz Attempts ────────────────────────────────────────────────────────────

export async function listQuizAttempts(userId: number) {
  try {
    return await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId))
      .orderBy(desc(quizAttempts.createdAt))
      .limit(30)
  } catch (error) {
    throw dbErr('load quiz history', error)
  }
}

export function computeWeakTopics(
  attempts: Array<typeof quizAttempts.$inferSelect>
) {
  const byKey = new Map<
    string,
    {
      subject: string
      topic: string
      attempts: number
      scoreSum: number
      totalSum: number
      missedQuestions: MissedQuizQuestionRecord[]
    }
  >()

  for (const a of attempts) {
    const topicLabel = (a.topic || a.subject || 'General').trim()
    const key = `${a.subject}::${topicLabel}`
    const cur = byKey.get(key) ?? {
      subject: a.subject,
      topic: topicLabel,
      attempts: 0,
      scoreSum: 0,
      totalSum: 0,
      missedQuestions: [],
    }
    cur.attempts += 1
    cur.scoreSum += a.score
    cur.totalSum += Math.max(1, a.totalQuestions)
    if (Array.isArray(a.missedQuestions)) {
      for (const mq of a.missedQuestions) {
        if (cur.missedQuestions.length < 25) {
          cur.missedQuestions.push(mq)
        }
      }
    }
    byKey.set(key, cur)
  }

  return Array.from(byKey.values())
    .map((entry) => {
      const avgPct = entry.totalSum > 0 ? Math.round((entry.scoreSum / entry.totalSum) * 100) : 0
      return {
        subject: entry.subject,
        topic: entry.topic,
        attempts: entry.attempts,
        avgScorePct: avgPct,
        missedCount: entry.missedQuestions.length,
        missedQuestions: entry.missedQuestions,
      }
    })
    .filter((entry) => entry.avgScorePct < 80 || entry.missedCount > 0)
    .sort((a, b) => a.avgScorePct - b.avgScorePct || b.missedCount - a.missedCount)
    .slice(0, 6)
}

export async function recordQuizAttempt(
  userId: number,
  data: {
    subject: string
    topic?: string
    difficulty: string
    score: number
    totalQuestions: number
    missedQuestions?: MissedQuizQuestionRecord[]
  }
) {
  try {
    const [attempt] = await db
      .insert(quizAttempts)
      .values({
        userId,
        subject: data.subject,
        topic: data.topic || null,
        difficulty: data.difficulty,
        score: data.score,
        totalQuestions: data.totalQuestions,
        missedQuestions: data.missedQuestions ?? [],
      })
      .returning()

    const earnedXp = Math.max(10, data.score * 15)
    await db
      .update(users)
      .set({
        xp: sql`${users.xp} + ${earnedXp}`,
        level: sql`GREATEST(1, FLOOR((${users.xp} + ${earnedXp}) / 500) + 1)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    await db.insert(xpEvents).values({
      userId,
      source: 'quiz',
      points: earnedXp,
      description: `Completed ${data.subject} quiz (${data.score}/${data.totalQuestions})`,
    })

    await syncUserStreak(userId)

    const [updatedUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    return { attempt, xpEarned: earnedXp, user: updatedUser }
  } catch (error) {
    throw dbErr('save quiz result', error)
  }
}

// ── Chat Conversations & Messages ────────────────────────────────────────────

export async function listChatConversations(userId: number) {
  try {
    const conversations = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(desc(chatConversations.updatedAt))

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(chatMessages.createdAt, chatMessages.id)

    const byConv = new Map<number, typeof messages>()
    for (const msg of messages) {
      const list = byConv.get(msg.conversationId) ?? []
      list.push(msg)
      byConv.set(msg.conversationId, list)
    }

    return conversations.map((c) => ({
      ...c,
      messages: byConv.get(c.id) ?? [],
    }))
  } catch (error) {
    throw dbErr('load chat conversations', error)
  }
}

export async function createChatConversation(
  userId: number,
  data: { title: string; subject?: string; topic?: string }
) {
  try {
    const [conv] = await db
      .insert(chatConversations)
      .values({
        userId,
        title: data.title || 'New conversation',
        subject: data.subject || null,
        topic: data.topic || null,
      })
      .returning()
    return { ...conv, messages: [] }
  } catch (error) {
    throw dbErr('create chat conversation', error)
  }
}

export async function updateChatConversationTitle(
  userId: number,
  conversationId: number,
  title: string
) {
  try {
    const [updated] = await db
      .update(chatConversations)
      .set({ title, updatedAt: new Date() })
      .where(
        and(
          eq(chatConversations.id, conversationId),
          eq(chatConversations.userId, userId)
        )
      )
      .returning()
    return updated ?? null
  } catch (error) {
    throw dbErr('rename conversation', error)
  }
}

export async function deleteChatConversation(userId: number, conversationId: number) {
  try {
    const deleted = await db
      .delete(chatConversations)
      .where(
        and(
          eq(chatConversations.id, conversationId),
          eq(chatConversations.userId, userId)
        )
      )
      .returning({ id: chatConversations.id })
    return deleted.length > 0
  } catch (error) {
    throw dbErr('delete conversation', error)
  }
}

export async function appendChatMessages(
  userId: number,
  conversationId: number,
  items: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  try {
    const [conv] = await db
      .select({ id: chatConversations.id })
      .from(chatConversations)
      .where(
        and(
          eq(chatConversations.id, conversationId),
          eq(chatConversations.userId, userId)
        )
      )
      .limit(1)

    if (!conv) return null

    const inserted = await db
      .insert(chatMessages)
      .values(
        items.map((m) => ({
          conversationId,
          userId,
          role: m.role,
          content: m.content,
        }))
      )
      .returning()

    await db
      .update(chatConversations)
      .set({ updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId))

    return inserted
  } catch (error) {
    throw dbErr('save chat messages', error)
  }
}

export async function updateChatMessageLike(
  userId: number,
  messageId: number,
  liked: boolean | null
) {
  try {
    const [updated] = await db
      .update(chatMessages)
      .set({ liked })
      .where(and(eq(chatMessages.id, messageId), eq(chatMessages.userId, userId)))
      .returning()
    return updated ?? null
  } catch (error) {
    throw dbErr('update message feedback', error)
  }
}

// ── Attendance ───────────────────────────────────────────────────────────────

export async function listAttendanceSubjects(userId: number) {
  try {
    return await db
      .select()
      .from(attendanceSubjects)
      .where(eq(attendanceSubjects.userId, userId))
      .orderBy(attendanceSubjects.id)
  } catch (error) {
    throw dbErr('load attendance subjects', error)
  }
}

export async function createAttendanceSubject(
  userId: number,
  data: { name: string; required: number; attended: number; total: number }
) {
  try {
    const [created] = await db
      .insert(attendanceSubjects)
      .values({
        userId,
        name: data.name,
        required: data.required,
        attended: data.attended,
        total: data.total,
      })
      .returning()
    return created
  } catch (error) {
    throw dbErr('create attendance subject', error)
  }
}

export async function markAttendanceSubject(
  userId: number,
  subjectId: number,
  type: 'present' | 'absent'
) {
  try {
    const [updated] = await db
      .update(attendanceSubjects)
      .set({
        total: sql`${attendanceSubjects.total} + 1`,
        attended:
          type === 'present'
            ? sql`${attendanceSubjects.attended} + 1`
            : attendanceSubjects.attended,
      })
      .where(
        and(
          eq(attendanceSubjects.id, subjectId),
          eq(attendanceSubjects.userId, userId)
        )
      )
      .returning()
    return updated ?? null
  } catch (error) {
    throw dbErr('mark attendance', error)
  }
}

export async function deleteAttendanceSubject(userId: number, subjectId: number) {
  try {
    const deleted = await db
      .delete(attendanceSubjects)
      .where(
        and(
          eq(attendanceSubjects.id, subjectId),
          eq(attendanceSubjects.userId, userId)
        )
      )
      .returning({ id: attendanceSubjects.id })
    return deleted.length > 0
  } catch (error) {
    throw dbErr('delete attendance subject', error)
  }
}

// ── CGPA Semesters & Courses ─────────────────────────────────────────────────

export async function listCgpaSemesters(userId: number) {
  try {
    const semesters = await db
      .select()
      .from(cgpaSemesters)
      .where(eq(cgpaSemesters.userId, userId))
      .orderBy(cgpaSemesters.sortOrder, cgpaSemesters.id)

    const courses = await db
      .select()
      .from(cgpaCourses)
      .where(eq(cgpaCourses.userId, userId))
      .orderBy(cgpaCourses.id)

    const bySem = new Map<number, typeof courses>()
    for (const course of courses) {
      const list = bySem.get(course.semesterId) ?? []
      list.push(course)
      bySem.set(course.semesterId, list)
    }

    return semesters.map((s) => ({
      ...s,
      subjects: bySem.get(s.id) ?? [],
    }))
  } catch (error) {
    throw dbErr('load CGPA semesters', error)
  }
}

export async function createCgpaSemester(userId: number, name: string) {
  try {
    const existing = await db
      .select({ id: cgpaSemesters.id })
      .from(cgpaSemesters)
      .where(eq(cgpaSemesters.userId, userId))

    const [sem] = await db
      .insert(cgpaSemesters)
      .values({
        userId,
        name: name || `Semester ${existing.length + 1}`,
        sortOrder: existing.length + 1,
      })
      .returning()

    const [defaultCourse] = await db
      .insert(cgpaCourses)
      .values({
        semesterId: sem.id,
        userId,
        name: 'Subject 1',
        credits: 3,
        grade: 'A',
      })
      .returning()

    return { ...sem, subjects: [defaultCourse] }
  } catch (error) {
    throw dbErr('create semester', error)
  }
}

export async function createCgpaCourse(
  userId: number,
  semesterId: number,
  data: { name: string; credits: number; grade: string }
) {
  try {
    const [sem] = await db
      .select({ id: cgpaSemesters.id })
      .from(cgpaSemesters)
      .where(and(eq(cgpaSemesters.id, semesterId), eq(cgpaSemesters.userId, userId)))
      .limit(1)

    if (!sem) return null

    const [course] = await db
      .insert(cgpaCourses)
      .values({
        semesterId,
        userId,
        name: data.name || 'New Subject',
        credits: data.credits || 3,
        grade: data.grade || 'A',
      })
      .returning()

    return course
  } catch (error) {
    throw dbErr('add course', error)
  }
}

export async function updateCgpaCourse(
  userId: number,
  courseId: number,
  updates: { name?: string; credits?: number; grade?: string }
) {
  try {
    const [updated] = await db
      .update(cgpaCourses)
      .set(updates)
      .where(and(eq(cgpaCourses.id, courseId), eq(cgpaCourses.userId, userId)))
      .returning()
    return updated ?? null
  } catch (error) {
    throw dbErr('update course', error)
  }
}

export async function deleteCgpaCourse(userId: number, courseId: number) {
  try {
    const deleted = await db
      .delete(cgpaCourses)
      .where(and(eq(cgpaCourses.id, courseId), eq(cgpaCourses.userId, userId)))
      .returning({ id: cgpaCourses.id })
    return deleted.length > 0
  } catch (error) {
    throw dbErr('delete course', error)
  }
}

// ── Pomodoro Focus Sessions ──────────────────────────────────────────────────

export async function listPomodoroStats(userId: number) {
  try {
    const sessions = await db
      .select()
      .from(pomodoroSessions)
      .where(eq(pomodoroSessions.userId, userId))
      .orderBy(desc(pomodoroSessions.completedAt))
      .limit(100)

    const todayStr = new Date().toISOString().slice(0, 10)
    const todaySessions = sessions.filter(
      (s) => s.completedAt.toISOString().slice(0, 10) === todayStr
    )

    return {
      todaySessions: todaySessions.length,
      todayFocusMinutes: todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0),
      totalSessions: sessions.length,
      totalFocusMinutes: sessions.reduce((sum, s) => sum + s.durationMinutes, 0),
      recent: sessions.slice(0, 10),
    }
  } catch (error) {
    throw dbErr('load focus sessions', error)
  }
}

export async function recordPomodoroSession(
  userId: number,
  durationMinutes: number,
  subject?: string
) {
  try {
    const [session] = await db
      .insert(pomodoroSessions)
      .values({
        userId,
        durationMinutes,
        subject: subject || null,
      })
      .returning()

    const earnedXp = Math.max(10, Math.round(durationMinutes / 2))
    await db
      .update(users)
      .set({
        xp: sql`${users.xp} + ${earnedXp}`,
        level: sql`GREATEST(1, FLOOR((${users.xp} + ${earnedXp}) / 500) + 1)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    await db.insert(xpEvents).values({
      userId,
      source: 'pomodoro',
      points: earnedXp,
      description: `Completed ${durationMinutes}m focus session${subject ? ` (${subject})` : ''}`,
    })

    await syncUserStreak(userId)

    return session
  } catch (error) {
    throw dbErr('record focus session', error)
  }
}

export async function getWeeklySummaryContext(userId: number) {
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000)
    const [userRow, settings, pomodoros, quizzes, tasks, exams, cards, userNotes] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      getUserSettings(userId),
      db.select().from(pomodoroSessions).where(eq(pomodoroSessions.userId, userId)),
      db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)).orderBy(desc(quizAttempts.createdAt)),
      db.select().from(studyTasks).where(eq(studyTasks.userId, userId)),
      db.select().from(studyExams).where(eq(studyExams.userId, userId)).orderBy(studyExams.examDate),
      db.select().from(flashcards).where(eq(flashcards.userId, userId)),
      db.select().from(notes).where(eq(notes.userId, userId)),
    ])

    const recentPomodoros = pomodoros.filter((p) => p.completedAt >= weekAgo)
    const recentQuizzes = quizzes.filter((q) => q.createdAt >= weekAgo)
    const weeklyFocusMinutes = recentPomodoros.reduce((s, p) => s + p.durationMinutes, 0)
    const quizScoreSum = recentQuizzes.reduce((s, q) => s + q.score, 0)
    const quizTotalSum = recentQuizzes.reduce((s, q) => s + Math.max(1, q.totalQuestions), 0)
    const weakTopics = computeWeakTopics(quizzes)
    const now = new Date()
    const dueCardsCount = cards.filter((c) => c.dueDate <= now).length

    return {
      userName: userRow[0]?.name || 'Student',
      streak: userRow[0]?.streak ?? 1,
      xp: userRow[0]?.xp ?? 0,
      dailyGoalMinutes: settings?.dailyGoalMinutes ?? 60,
      weeklyFocusMinutes,
      weeklyFocusSessions: recentPomodoros.length,
      weeklyQuizzesCount: recentQuizzes.length,
      weeklyQuizAccuracy: quizTotalSum > 0 ? Math.round((quizScoreSum / quizTotalSum) * 100) : null,
      tasksCompleted: tasks.filter((t) => t.done).length,
      tasksPending: tasks.filter((t) => !t.done).length,
      upcomingExams: exams.slice(0, 5).map((e) => ({
        subject: e.subject,
        examDate: e.examDate.toISOString().slice(0, 10),
        hoursNeeded: e.hoursNeeded,
      })),
      dueFlashcards: dueCardsCount,
      totalNotes: userNotes.length,
      weakTopics: weakTopics.slice(0, 3).map((w) => ({
        subject: w.subject,
        topic: w.topic,
        avgScorePct: w.avgScorePct,
      })),
    }
  } catch (error) {
    throw dbErr('build weekly summary context', error)
  }
}

// ── Dashboard & Analytics & Search & Export ──────────────────────────────────

export async function getDashboardSummary(userId: number) {
  try {
    const [
      userNotes,
      decks,
      exams,
      tasks,
      quizzes,
      pomodoros,
    ] = await Promise.all([
      db.select().from(notes).where(eq(notes.userId, userId)).orderBy(desc(notes.updatedAt)).limit(5),
      db.select().from(flashcardDecks).where(eq(flashcardDecks.userId, userId)),
      db.select().from(studyExams).where(eq(studyExams.userId, userId)).orderBy(studyExams.examDate).limit(5),
      db.select().from(studyTasks).where(eq(studyTasks.userId, userId)).orderBy(studyTasks.taskDate),
      db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)).orderBy(desc(quizAttempts.createdAt)).limit(10),
      db.select().from(pomodoroSessions).where(eq(pomodoroSessions.userId, userId)).orderBy(desc(pomodoroSessions.completedAt)).limit(50),
    ])

    const completedTasksCount = tasks.filter((t) => t.done).length
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayFocusMinutes = pomodoros
      .filter((p) => p.completedAt.toISOString().slice(0, 10) === todayStr)
      .reduce((sum, p) => sum + p.durationMinutes, 0)

    const weekAgo = Date.now() - 7 * 86400000
    const weeklyFocusMinutes = pomodoros
      .filter((p) => p.completedAt.getTime() >= weekAgo)
      .reduce((sum, p) => sum + p.durationMinutes, 0)

    const totalFocusMinutes = pomodoros.reduce((sum, p) => sum + p.durationMinutes, 0)

    return {
      counts: {
        notes: userNotes.length,
        decks: decks.length,
        exams: exams.length,
        tasksTotal: tasks.length,
        tasksCompleted: completedTasksCount,
        quizzes: quizzes.length,
      },
      focus: {
        todayMinutes: todayFocusMinutes,
        weeklyHours: Math.round((weeklyFocusMinutes / 60) * 10) / 10,
        totalHours: Math.round((totalFocusMinutes / 60) * 10) / 10,
        sessionsCount: pomodoros.length,
      },
      recentNotes: userNotes.slice(0, 3),
      upcomingExams: exams.slice(0, 3),
      pendingTasks: tasks.filter((t) => !t.done).slice(0, 5),
      recentQuizzes: quizzes.slice(0, 5),
    }
  } catch (error) {
    throw dbErr('load dashboard summary', error)
  }
}

export async function searchWorkspace(userId: number, q: string) {
  try {
    const term = `%${q.trim()}%`
    const [matchedNotes, matchedConvs, matchedDecks] = await Promise.all([
      db
        .select()
        .from(notes)
        .where(
          and(
            eq(notes.userId, userId),
            q.trim()
              ? or(ilike(notes.title, term), ilike(notes.content, term))
              : undefined
          )
        )
        .orderBy(desc(notes.updatedAt))
        .limit(20),
      db
        .select()
        .from(chatConversations)
        .where(
          and(
            eq(chatConversations.userId, userId),
            q.trim() ? ilike(chatConversations.title, term) : undefined
          )
        )
        .orderBy(desc(chatConversations.updatedAt))
        .limit(20),
      db
        .select()
        .from(flashcardDecks)
        .where(
          and(
            eq(flashcardDecks.userId, userId),
            q.trim()
              ? or(ilike(flashcardDecks.name, term), ilike(flashcardDecks.subject, term))
              : undefined
          )
        )
        .orderBy(desc(flashcardDecks.createdAt))
        .limit(20),
    ])

    return {
      notes: matchedNotes,
      conversations: matchedConvs,
      flashcardDecks: matchedDecks,
    }
  } catch (error) {
    throw dbErr('search workspace', error)
  }
}

export async function getAnalyticsAndMilestones(userId: number) {
  try {
    const [
      userRow,
      userNotes,
      decks,
      cards,
      tasks,
      quizzes,
      pomodoros,
    ] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      db.select().from(notes).where(eq(notes.userId, userId)),
      db.select().from(flashcardDecks).where(eq(flashcardDecks.userId, userId)),
      db.select().from(flashcards).where(eq(flashcards.userId, userId)),
      db.select().from(studyTasks).where(eq(studyTasks.userId, userId)),
      db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)),
      db.select().from(pomodoroSessions).where(eq(pomodoroSessions.userId, userId)),
    ])

    const user = userRow[0]
    const now = new Date()
    const dayKey = (d: Date) => d.toISOString().slice(0, 10)

    const minutesByDay = new Map<string, number>()
    const activityCountByDay = new Map<string, number>()

    const addActivity = (d: Date, mins: number) => {
      const k = dayKey(d)
      minutesByDay.set(k, (minutesByDay.get(k) ?? 0) + mins)
      activityCountByDay.set(k, (activityCountByDay.get(k) ?? 0) + 1)
    }

    for (const p of pomodoros) addActivity(p.completedAt, p.durationMinutes)
    for (const q of quizzes) addActivity(q.createdAt, Math.max(10, q.totalQuestions * 2))
    for (const n of userNotes) addActivity(n.updatedAt, 15)
    for (const t of tasks) {
      if (t.done) addActivity(t.taskDate, t.duration)
    }

    const dailySeries = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now)
      d.setDate(now.getDate() - 29 + i)
      const k = dayKey(d)
      const hours = Math.round(((minutesByDay.get(k) ?? 0) / 60) * 100) / 100
      return {
        date: k,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        hours,
      }
    })

    const totalHours = Math.round(dailySeries.reduce((s, d) => s + d.hours, 0) * 10) / 10
    const avgDailyHours = Math.round((totalHours / 30) * 10) / 10
    const bestDayHours = Math.round(Math.max(0, ...dailySeries.map((d) => d.hours)) * 10) / 10

    const subjectMinutes = new Map<string, number>()
    const addSubj = (name: string | null | undefined, mins: number) => {
      const clean = (name || 'General').trim() || 'General'
      subjectMinutes.set(clean, (subjectMinutes.get(clean) ?? 0) + mins)
    }
    for (const p of pomodoros) addSubj(p.subject || 'Focus', p.durationMinutes)
    for (const q of quizzes) addSubj(q.subject, Math.max(10, q.totalQuestions * 2))
    for (const t of tasks) {
      if (t.done) addSubj(t.subject, t.duration)
    }
    for (const d of decks) addSubj(d.subject, Math.max(10, cards.filter((c) => c.deckId === d.id).reduce((s, c) => s + Math.max(1, c.reviewCount) * 2, 0)))

    const subjectSeries = Array.from(subjectMinutes.entries())
      .map(([subject, mins]) => ({ subject, hours: Math.round((mins / 60) * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6)

    const focusMinutes = pomodoros.reduce((s, p) => s + p.durationMinutes, 0)
    const quizMinutes = quizzes.reduce((s, q) => s + Math.max(10, q.totalQuestions * 2), 0)
    const notesMinutes = userNotes.length * 15
    const flashcardMinutes = cards.reduce((s, c) => s + c.reviewCount * 2, 0)

    const timeDistribution = [
      { label: 'Focus Timer', minutes: focusMinutes },
      { label: 'Quizzes', minutes: quizMinutes },
      { label: 'Notes', minutes: notesMinutes },
      { label: 'Flashcards', minutes: flashcardMinutes },
    ]

    // 7 weekday rows x 7 weeks columns
    const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => 0))
    for (let i = 0; i < 49; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() - 48 + i)
      const count = activityCountByDay.get(dayKey(d)) ?? 0
      const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4
      const jsDay = d.getDay()
      const monIdx = jsDay === 0 ? 6 : jsDay - 1
      const weekIdx = Math.floor(i / 7)
      heatmap[monIdx][weekIdx] = level
    }

    const totalReviews = cards.reduce((s, c) => s + c.reviewCount, 0)
    const highScoreQuizzes = quizzes.filter((q) => q.totalQuestions > 0 && q.score / q.totalQuestions >= 0.8).length
    const completedTasks = tasks.filter((t) => t.done).length
    const streak = user?.streak ?? 1

    const milestones = [
      {
        id: 'first-note',
        icon: '📚',
        name: 'Note Architect',
        desc: 'Create 5 study notes in your library',
        category: 'Library',
        current: userNotes.length,
        target: 5,
        earned: userNotes.length >= 5,
      },
      {
        id: 'flashcard-reviews',
        icon: '⚡',
        name: 'Active Recall',
        desc: 'Complete 25 flashcard reviews',
        category: 'Practice',
        current: totalReviews,
        target: 25,
        earned: totalReviews >= 25,
      },
      {
        id: 'quiz-precision',
        icon: '🎯',
        name: 'Quiz Precision',
        desc: 'Score 80%+ on 3 practice quizzes',
        category: 'Quiz',
        current: highScoreQuizzes,
        target: 3,
        earned: highScoreQuizzes >= 3,
      },
      {
        id: 'deep-focus',
        icon: '⏱️',
        name: 'Deep Focus',
        desc: 'Complete 10 Pomodoro focus sessions',
        category: 'Timer',
        current: pomodoros.length,
        target: 10,
        earned: pomodoros.length >= 10,
      },
      {
        id: 'task-finisher',
        icon: '✅',
        name: 'Schedule Keeper',
        desc: 'Complete 10 planned study tasks',
        category: 'Planner',
        current: completedTasks,
        target: 10,
        earned: completedTasks >= 10,
      },
      {
        id: 'streak',
        icon: '🔥',
        name: 'Consistent Streak',
        desc: 'Reach a 7-day study streak',
        category: 'Streak',
        current: streak,
        target: 7,
        earned: streak >= 7,
      },
    ]

    return {
      summary: {
        totalHours,
        avgDailyHours,
        bestDayHours,
        streak,
      },
      dailySeries,
      subjectSeries,
      timeDistribution,
      heatmap,
      milestones,
    }
  } catch (error) {
    throw dbErr('load analytics', error)
  }
}

export async function getLeaderboard(currentUserId: number) {
  try {
    const [allUsers, allPomodoros, allQuizAttempts, allSettings] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          xp: users.xp,
          level: users.level,
          streak: users.streak,
        })
        .from(users)
        .orderBy(desc(users.xp), desc(users.streak))
        .limit(100),
      db
        .select({
          userId: pomodoroSessions.userId,
          durationMinutes: pomodoroSessions.durationMinutes,
          completedAt: pomodoroSessions.completedAt,
        })
        .from(pomodoroSessions),
      db
        .select({
          userId: quizAttempts.userId,
          score: quizAttempts.score,
          totalQuestions: quizAttempts.totalQuestions,
          createdAt: quizAttempts.createdAt,
        })
        .from(quizAttempts),
      db
        .select({
          userId: userSettings.userId,
          leaderboardVisible: userSettings.leaderboardVisible,
        })
        .from(userSettings),
    ])

    const weekAgo = Date.now() - 7 * 86400000
    const minsByUser = new Map<number, number>()
    for (const p of allPomodoros) {
      if (p.completedAt.getTime() >= weekAgo) {
        minsByUser.set(p.userId, (minsByUser.get(p.userId) ?? 0) + p.durationMinutes)
      }
    }

    const quizStatsByUser = new Map<number, { count: number; scoreSum: number; totalSum: number }>()
    for (const q of allQuizAttempts) {
      if (q.createdAt.getTime() >= weekAgo) {
        const cur = quizStatsByUser.get(q.userId) ?? { count: 0, scoreSum: 0, totalSum: 0 }
        cur.count += 1
        cur.scoreSum += q.score
        cur.totalSum += Math.max(1, q.totalQuestions)
        quizStatsByUser.set(q.userId, cur)
      }
    }

    const visibilityMap = new Map<number, boolean>()
    for (const s of allSettings) {
      visibilityMap.set(s.userId, s.leaderboardVisible)
    }

    const currentUserOptedIn = visibilityMap.get(currentUserId) ?? false

    const buildEntry = (u: { id: number; name: string; xp: number; level: number; streak: number }) => {
      const weeklyHours = Math.round(((minsByUser.get(u.id) ?? 0) / 60) * 10) / 10
      const qStats = quizStatsByUser.get(u.id)
      const weeklyQuizzes = qStats?.count ?? 0
      const weeklyQuizAccuracy = qStats && qStats.totalSum > 0
        ? Math.round((qStats.scoreSum / qStats.totalSum) * 100)
        : 0
      const compositeScore = Math.round(
        u.xp + weeklyHours * 25 + weeklyQuizzes * 20 + u.streak * 15
      )
      const initials =
        u.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() || '')
          .join('') || 'S'

      return {
        id: u.id,
        name: u.name,
        avatar: initials,
        xp: u.xp,
        level: u.level,
        streak: u.streak,
        hours: weeklyHours,
        weeklyQuizzes,
        weeklyQuizAccuracy,
        compositeScore,
        isCurrentUser: u.id === currentUserId,
      }
    }

    const optedInUsers = allUsers.filter((u) => visibilityMap.get(u.id) === true)
    const entries = optedInUsers
      .map(buildEntry)
      .sort(
        (a, b) =>
          b.compositeScore - a.compositeScore ||
          b.xp - a.xp ||
          b.hours - a.hours ||
          b.streak - a.streak
      )
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
      }))

    const currentUserRow = allUsers.find((u) => u.id === currentUserId)
    const currentUserStats = currentUserRow ? buildEntry(currentUserRow) : null

    return {
      entries,
      optedIn: currentUserOptedIn,
      currentUserStats,
    }
  } catch (error) {
    throw dbErr('load leaderboard', error)
  }
}

// ── Saved PDFs ───────────────────────────────────────────────────────────────

export async function listSavedPdfs(userId: number) {
  try {
    return await db
      .select()
      .from(savedPdfs)
      .where(eq(savedPdfs.userId, userId))
      .orderBy(desc(savedPdfs.updatedAt))
      .limit(30)
  } catch (error) {
    throw dbErr('load saved PDFs', error)
  }
}

export async function createSavedPdf(
  userId: number,
  data: {
    fileName: string
    pageCount: number
    extractedText: string
    summary?: string
    keyPoints?: string[]
    highlights?: PdfHighlightRecord[]
    notes?: string
  }
) {
  try {
    const [created] = await db
      .insert(savedPdfs)
      .values({
        userId,
        fileName: data.fileName,
        pageCount: data.pageCount,
        extractedText: data.extractedText,
        summary: data.summary ?? '',
        keyPoints: data.keyPoints ?? [],
        highlights: data.highlights ?? [],
        notes: data.notes ?? '',
      })
      .returning()

    await db
      .update(users)
      .set({
        xp: sql`${users.xp} + 15`,
        level: sql`GREATEST(1, FLOOR((${users.xp} + 15) / 500) + 1)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    await db.insert(xpEvents).values({
      userId,
      source: 'pdf',
      points: 15,
      description: `Saved PDF study guide "${data.fileName}"`,
    })

    return created
  } catch (error) {
    throw dbErr('save PDF', error)
  }
}

export async function updateSavedPdf(
  userId: number,
  pdfId: number,
  updates: {
    summary?: string
    keyPoints?: string[]
    highlights?: PdfHighlightRecord[]
    notes?: string
  }
) {
  try {
    const [updated] = await db
      .update(savedPdfs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(savedPdfs.id, pdfId), eq(savedPdfs.userId, userId)))
      .returning()
    return updated ?? null
  } catch (error) {
    throw dbErr('update saved PDF', error)
  }
}

export async function deleteSavedPdf(userId: number, pdfId: number) {
  try {
    const deleted = await db
      .delete(savedPdfs)
      .where(and(eq(savedPdfs.id, pdfId), eq(savedPdfs.userId, userId)))
      .returning({ id: savedPdfs.id })
    return deleted.length > 0
  } catch (error) {
    throw dbErr('delete saved PDF', error)
  }
}

// ── Mind Maps ────────────────────────────────────────────────────────────────

export async function listMindMaps(userId: number) {
  try {
    return await db
      .select()
      .from(mindMaps)
      .where(eq(mindMaps.userId, userId))
      .orderBy(desc(mindMaps.updatedAt))
      .limit(40)
  } catch (error) {
    throw dbErr('load mind maps', error)
  }
}

export async function createMindMap(
  userId: number,
  data: { title: string; root: string; branches: MindMapBranchRecord[] }
) {
  try {
    const [created] = await db
      .insert(mindMaps)
      .values({
        userId,
        title: data.title,
        root: data.root,
        branches: data.branches,
      })
      .returning()

    await db
      .update(users)
      .set({
        xp: sql`${users.xp} + 10`,
        level: sql`GREATEST(1, FLOOR((${users.xp} + 10) / 500) + 1)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    await db.insert(xpEvents).values({
      userId,
      source: 'mindmap',
      points: 10,
      description: `Created mind map "${data.root}"`,
    })

    return created
  } catch (error) {
    throw dbErr('save mind map', error)
  }
}

export async function updateMindMap(
  userId: number,
  mapId: number,
  updates: { title?: string; root?: string; branches?: MindMapBranchRecord[] }
) {
  try {
    const [updated] = await db
      .update(mindMaps)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(mindMaps.id, mapId), eq(mindMaps.userId, userId)))
      .returning()
    return updated ?? null
  } catch (error) {
    throw dbErr('update mind map', error)
  }
}

export async function deleteMindMap(userId: number, mapId: number) {
  try {
    const deleted = await db
      .delete(mindMaps)
      .where(and(eq(mindMaps.id, mapId), eq(mindMaps.userId, userId)))
      .returning({ id: mindMaps.id })
    return deleted.length > 0
  } catch (error) {
    throw dbErr('delete mind map', error)
  }
}

// ── Achievements & XP Events ─────────────────────────────────────────────────

export async function getAchievementsAndXp(userId: number) {
  try {
    const [analytics, existingUnlocked, events, userRow] = await Promise.all([
      getAnalyticsAndMilestones(userId),
      db.select().from(userAchievements).where(eq(userAchievements.userId, userId)),
      db
        .select()
        .from(xpEvents)
        .where(eq(xpEvents.userId, userId))
        .orderBy(desc(xpEvents.createdAt))
        .limit(25),
      db.select().from(users).where(eq(users.id, userId)).limit(1),
    ])

    const unlockedKeys = new Set(existingUnlocked.map((a) => a.achievementKey))
    const newlyEarned = analytics.milestones.filter((m) => m.earned && !unlockedKeys.has(m.id))

    if (newlyEarned.length > 0) {
      let bonusXp = 0
      for (const m of newlyEarned) {
        const reward = 50
        bonusXp += reward
        await db.insert(userAchievements).values({
          userId,
          achievementKey: m.id,
          title: m.name,
          xpReward: reward,
        })
        await db.insert(xpEvents).values({
          userId,
          source: 'achievement',
          points: reward,
          description: `Unlocked milestone: ${m.name}`,
        })
      }
      await db
        .update(users)
        .set({
          xp: sql`${users.xp} + ${bonusXp}`,
          level: sql`GREATEST(1, FLOOR((${users.xp} + ${bonusXp}) / 500) + 1)`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
    }

    const [freshUnlocked, freshEvents, freshUser] = await Promise.all([
      newlyEarned.length > 0
        ? db.select().from(userAchievements).where(eq(userAchievements.userId, userId))
        : Promise.resolve(existingUnlocked),
      newlyEarned.length > 0
        ? db
            .select()
            .from(xpEvents)
            .where(eq(xpEvents.userId, userId))
            .orderBy(desc(xpEvents.createdAt))
            .limit(25)
        : Promise.resolve(events),
      newlyEarned.length > 0
        ? db.select().from(users).where(eq(users.id, userId)).limit(1)
        : Promise.resolve(userRow),
    ])

    return {
      milestones: analytics.milestones,
      unlockedAchievements: freshUnlocked,
      xpEvents: freshEvents,
      xp: freshUser[0]?.xp ?? 0,
      level: freshUser[0]?.level ?? 1,
    }
  } catch (error) {
    throw dbErr('load achievements and XP', error)
  }
}

// ── User Settings ────────────────────────────────────────────────────────────

export async function getUserSettings(userId: number) {
  try {
    const existing = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    if (existing[0]) return existing[0]

    const [created] = await db
      .insert(userSettings)
      .values({ userId })
      .onConflictDoNothing()
      .returning()

    if (created) return created

    const [fallback] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    return fallback
  } catch (error) {
    throw dbErr('load settings', error)
  }
}

export async function updateUserSettings(
  userId: number,
  updates: {
    theme?: 'light' | 'dark' | 'system'
    examReminders?: boolean
    streakAlerts?: boolean
    weeklySummary?: boolean
    leaderboardVisible?: boolean
    dailyGoalMinutes?: number
  }
) {
  try {
    await getUserSettings(userId)
    const [updated] = await db
      .update(userSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId))
      .returning()
    return updated
  } catch (error) {
    throw dbErr('update settings', error)
  }
}

export async function exportAllUserData(userId: number) {
  try {
    const [
      userNotes,
      decks,
      planner,
      quizzes,
      conversations,
      attendance,
      semesters,
      pomodoros,
      pdfs,
      maps,
      settings,
    ] = await Promise.all([
      listUserNotes(userId),
      listUserDecks(userId),
      listPlannerData(userId),
      listQuizAttempts(userId),
      listChatConversations(userId),
      listAttendanceSubjects(userId),
      listCgpaSemesters(userId),
      listPomodoroStats(userId),
      listSavedPdfs(userId),
      listMindMaps(userId),
      getUserSettings(userId),
    ])

    return {
      exportedAt: new Date().toISOString(),
      notes: userNotes,
      flashcardDecks: decks,
      exams: planner.exams,
      tasks: planner.tasks,
      quizAttempts: quizzes,
      conversations,
      attendanceSubjects: attendance,
      cgpaSemesters: semesters,
      pomodoroStats: pomodoros,
      savedPdfs: pdfs,
      mindMaps: maps,
      settings,
    }
  } catch (error) {
    throw dbErr('export workspace data', error)
  }
}
