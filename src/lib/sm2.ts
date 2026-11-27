export type Sm2Rating = 'again' | 'hard' | 'medium' | 'easy'

export interface Sm2CardState {
  easeFactor: number // stored as integer * 100 (e.g. 250 == 2.50)
  intervalDays: number
  repetitions: number
}

export interface Sm2Result extends Sm2CardState {
  dueDate: Date
  quality: number
}

const QUALITY_MAP: Record<Sm2Rating, number> = {
  again: 1,
  hard: 3,
  medium: 4,
  easy: 5,
}

export function calculateSm2(
  current: Partial<Sm2CardState>,
  rating: Sm2Rating,
  now: Date = new Date()
): Sm2Result {
  const easeFactor = typeof current.easeFactor === 'number' && current.easeFactor >= 130 ? current.easeFactor : 250
  const intervalDays = typeof current.intervalDays === 'number' && current.intervalDays >= 0 ? current.intervalDays : 0
  const repetitions = typeof current.repetitions === 'number' && current.repetitions >= 0 ? current.repetitions : 0

  const q = QUALITY_MAP[rating]
  const ef = easeFactor / 100
  const rawNextEf = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const nextEaseFactor = Math.max(130, Math.round(rawNextEf * 100))

  if (q < 3) {
    return {
      easeFactor: nextEaseFactor,
      intervalDays: 0,
      repetitions: 0,
      quality: q,
      dueDate: new Date(now.getTime() + 10 * 60 * 1000),
    }
  }

  let nextInterval: number
  if (repetitions === 0) {
    nextInterval = rating === 'easy' ? 4 : 1
  } else if (repetitions === 1) {
    nextInterval = rating === 'hard' ? 3 : rating === 'easy' ? 8 : 6
  } else {
    const base = Math.max(1, Math.round(intervalDays * (nextEaseFactor / 100)))
    if (rating === 'hard') {
      nextInterval = Math.max(intervalDays + 1, Math.round(base * 0.8))
    } else if (rating === 'easy') {
      nextInterval = Math.max(intervalDays + 2, Math.round(base * 1.3))
    } else {
      nextInterval = Math.max(intervalDays + 1, base)
    }
  }

  return {
    easeFactor: nextEaseFactor,
    intervalDays: nextInterval,
    repetitions: repetitions + 1,
    quality: q,
    dueDate: new Date(now.getTime() + nextInterval * 86400000),
  }
}

export function formatIntervalLabel(intervalDays: number): string {
  if (intervalDays <= 0) return '10m'
  if (intervalDays < 30) return `${intervalDays}d`
  if (intervalDays < 365) return `${Math.max(1, Math.round(intervalDays / 30))}mo`
  return `${(intervalDays / 365).toFixed(1)}y`
}
