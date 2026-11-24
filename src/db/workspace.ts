import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from './index.ts'
import {
  attendanceSubjects,
  cgpaCourses,
  cgpaSemesters,
  chatConversations,
  chatMessages,
  flashcardDecks,
  flashcards,
  notes,
  pomodoroSessions,
  quizAttempts,
  studyExams,
  studyTasks,
  users,
} from './schema.ts'

function dbErr(context: string, error: unknown): Error {
  console.error(`Database error (${context}):`, error)
  return new Error(`Failed to ${context}. Please try again later.`, { cause: error })
}

// ── Notes ────────────────────────────────────────────────────────────────────

export async function listUserNotes(userId: number) {
  try {
    return await db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.updatedAt))
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
  difficulty: 'easy' | 'medium' | 'hard'
) {
  try {
    const days = difficulty === 'easy' ? 7 : difficulty === 'medium' ? 3 : 1
    const dueDate = new Date(Date.now() + days * 86400000)

    const [updated] = await db
      .update(flashcards)
      .set({
        difficulty,
        dueDate,
        reviewCount: sql`${flashcards.reviewCount} + 1`,
      })
      .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)))
      .returning()

    return updated ?? null
  } catch (error) {
    throw dbErr('update flashcard review', error)
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

export async function toggleStudyTask(userId: number, taskId: number, done: boolean) {
  try {
    const [updated] = await db
      .update(studyTasks)
      .set({ done })
      .where(and(eq(studyTasks.id, taskId), eq(studyTasks.userId, userId)))
      .returning()
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
      .limit(20)
  } catch (error) {
    throw dbErr('load quiz history', error)
  }
}

export async function recordQuizAttempt(
  userId: number,
  data: {
    subject: string
    topic?: string
    difficulty: string
    score: number
    totalQuestions: number
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
      })
      .returning()

    const earnedXp = Math.max(10, data.score * 15)
    const [updatedUser] = await db
      .update(users)
      .set({
        xp: sql`${users.xp} + ${earnedXp}`,
        level: sql`GREATEST(1, FLOOR((${users.xp} + ${earnedXp}) / 500) + 1)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning()

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

    return session
  } catch (error) {
    throw dbErr('record focus session', error)
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
    ] = await Promise.all([
      listUserNotes(userId),
      listUserDecks(userId),
      listPlannerData(userId),
      listQuizAttempts(userId),
      listChatConversations(userId),
      listAttendanceSubjects(userId),
      listCgpaSemesters(userId),
      listPomodoroStats(userId),
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
    }
  } catch (error) {
    throw dbErr('export workspace data', error)
  }
}
