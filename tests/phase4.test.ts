import { describe, expect, it } from 'vitest'
import { buildStudyCalendarIcs } from '../frontend/src/lib/ics.ts'
import { computeWeakTopics } from '../src/db/workspace.ts'

describe('Phase 4 utilities: ICS export and weak-topic analytics', () => {
  it('generates valid RFC 5545 .ics calendar events for exams and pending tasks', () => {
    const ics = buildStudyCalendarIcs(
      [{ id: 1, subject: 'Algorithms', date: new Date('2026-06-20T00:00:00.000Z'), hoursNeeded: 12 }],
      [
        { id: 2, subject: 'Algorithms', topic: 'Dynamic Programming; Memoization', date: new Date('2026-06-15T12:00:00.000Z'), duration: 90, done: false },
        { id: 3, subject: 'Algorithms', topic: 'Already Done', date: new Date('2026-06-14T12:00:00.000Z'), duration: 60, done: true },
      ],
      new Date('2026-06-01T08:00:00.000Z')
    )

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('SUMMARY:Exam: Algorithms')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260620')
    expect(ics).toContain('SUMMARY:[Algorithms] Dynamic Programming\\; Memoization')
    expect(ics).not.toContain('Already Done')
  })

  it('aggregates weak quiz topics under 80% accuracy sorted lowest-first', () => {
    const now = new Date()
    const weak = computeWeakTopics([
      {
        id: 1,
        userId: 1,
        difficulty: 'medium',
        createdAt: now,
        subject: 'Chemistry',
        topic: 'Thermodynamics',
        score: 2,
        totalQuestions: 5,
        missedQuestions: [
          { question: 'Enthalpy sign?', options: ['+', '-'], correct: 1, selected: 0 },
        ],
      },
      {
        id: 2,
        userId: 1,
        difficulty: 'easy',
        createdAt: now,
        subject: 'Math',
        topic: 'Derivatives',
        score: 5,
        totalQuestions: 5,
        missedQuestions: [],
      },
    ])

    expect(weak.length).toBe(1)
    expect(weak[0].subject).toBe('Chemistry')
    expect(weak[0].topic).toBe('Thermodynamics')
    expect(weak[0].avgScorePct).toBe(40)
    expect(weak[0].missedQuestions.length).toBe(1)
  })
})
