import { describe, expect, it } from 'vitest'
import { calculateSm2, formatIntervalLabel } from '../src/lib/sm2.ts'

describe('SM-2 spaced repetition scheduler', () => {
  const baseDate = new Date('2026-06-01T10:00:00.000Z')

  it('resets repetitions and sets 10-minute re-review when rated again', () => {
    const result = calculateSm2(
      { easeFactor: 250, intervalDays: 12, repetitions: 3 },
      'again',
      baseDate
    )
    expect(result.repetitions).toBe(0)
    expect(result.intervalDays).toBe(0)
    expect(result.easeFactor).toBeLessThan(250)
    expect(result.easeFactor).toBeGreaterThanOrEqual(130)
    expect(result.dueDate.getTime()).toBe(baseDate.getTime() + 10 * 60 * 1000)
    expect(formatIntervalLabel(result.intervalDays)).toBe('10m')
  })

  it('progresses intervals cleanly across medium reviews', () => {
    const first = calculateSm2({}, 'medium', baseDate)
    expect(first.repetitions).toBe(1)
    expect(first.intervalDays).toBe(1)

    const second = calculateSm2(first, 'medium', baseDate)
    expect(second.repetitions).toBe(2)
    expect(second.intervalDays).toBe(6)

    const third = calculateSm2(second, 'medium', baseDate)
    expect(third.repetitions).toBe(3)
    expect(third.intervalDays).toBeGreaterThanOrEqual(14)
  })

  it('rewards easy recalls with longer intervals and higher ease factor', () => {
    const firstEasy = calculateSm2({ easeFactor: 250, intervalDays: 0, repetitions: 0 }, 'easy', baseDate)
    expect(firstEasy.intervalDays).toBe(4)
    expect(firstEasy.easeFactor).toBe(260)
  })
})
