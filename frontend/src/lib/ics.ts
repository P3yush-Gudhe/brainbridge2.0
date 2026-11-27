export interface IcsExamItem {
  id: number
  subject: string
  date: Date
  hoursNeeded: number
}

export interface IcsTaskItem {
  id: number
  subject: string
  topic: string
  date: Date
  duration: number
  done: boolean
}

function formatIcsDateOnly(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function formatIcsUtcTimestamp(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mm = String(date.getUTCMinutes()).padStart(2, '0')
  const ss = String(date.getUTCSeconds()).padStart(2, '0')
  return `${y}${m}${d}T${hh}${mm}${ss}Z`
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

export function buildStudyCalendarIcs(
  exams: IcsExamItem[],
  tasks: IcsTaskItem[],
  now: Date = new Date()
): string {
  const dtstamp = formatIcsUtcTimestamp(now)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyMate//Academic Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:StudyMate Schedule',
  ]

  for (const exam of exams) {
    const start = new Date(exam.date)
    const end = new Date(start.getTime() + 86400000)
    lines.push(
      'BEGIN:VEVENT',
      `UID:studymate-exam-${exam.id}@studymate.local`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${formatIcsDateOnly(start)}`,
      `DTEND;VALUE=DATE:${formatIcsDateOnly(end)}`,
      `SUMMARY:${escapeIcsText(`Exam: ${exam.subject}`)}`,
      `DESCRIPTION:${escapeIcsText(`Target preparation: ${exam.hoursNeeded} hours`)}`,
      'END:VEVENT'
    )
  }

  for (const task of tasks.filter((t) => !t.done)) {
    const start = new Date(task.date)
    start.setUTCHours(9, 0, 0, 0)
    const durationMin = Math.max(15, task.duration || 60)
    const end = new Date(start.getTime() + durationMin * 60 * 1000)
    lines.push(
      'BEGIN:VEVENT',
      `UID:studymate-task-${task.id}@studymate.local`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${formatIcsUtcTimestamp(start)}`,
      `DTEND:${formatIcsUtcTimestamp(end)}`,
      `SUMMARY:${escapeIcsText(`[${task.subject}] ${task.topic}`)}`,
      `DESCRIPTION:${escapeIcsText(`Study block (${durationMin} minutes)`)}`,
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
