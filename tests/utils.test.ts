import { describe, expect, it } from 'vitest'
import {
  cn,
  formatBytes,
  formatDate,
  formatDuration,
  formatRelativeTime,
  truncate,
} from '../frontend/src/lib/utils.ts'

describe('frontend utils', () => {
  it('merges tailwind classes cleanly with cn()', () => {
    expect(cn('px-2 py-1', 'px-4', false && 'hidden', 'text-sm')).toBe('py-1 px-4 text-sm')
  })

  it('formats durations in mm:ss and h:mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(75)).toBe('01:15')
    expect(formatDuration(3665)).toBe('1:01:05')
  })

  it('truncates long strings cleanly', () => {
    expect(truncate('short', 10)).toBe('short')
    expect(truncate('hello world', 5)).toBe('hello...')
  })

  it('formats byte sizes cleanly', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats dates and relative timestamps', () => {
    expect(formatDate('2026-01-15T12:00:00Z')).toContain('2026')
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago')
  })
})
