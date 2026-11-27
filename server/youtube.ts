export interface TranscriptSegment {
  time: string
  seconds: number
  text: string
}

export interface YouTubeTranscriptResult {
  videoId: string
  title: string
  channel: string
  duration: string
  segments: TranscriptSegment[]
  fullText: string
}

export class YouTubeTranscriptError extends Error {
  status: number
  constructor(message: string, status = 422) {
    super(message)
    this.name = 'YouTubeTranscriptError'
    this.status = status
  }
}

const ALLOWED_YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
])

export function extractYouTubeVideoId(rawUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    throw new YouTubeTranscriptError('Please enter a valid YouTube URL.', 400)
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new YouTubeTranscriptError('Invalid URL protocol.', 400)
  }

  if (!ALLOWED_YT_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new YouTubeTranscriptError('Only valid YouTube links (youtube.com or youtu.be) are supported.', 400)
  }

  let videoId = ''
  if (parsed.hostname.toLowerCase().includes('youtu.be')) {
    videoId = parsed.pathname.replace(/^\//, '').split('/')[0] || ''
  } else {
    videoId = parsed.searchParams.get('v') || ''
    if (!videoId && parsed.pathname.includes('/embed/')) {
      videoId = parsed.pathname.split('/embed/')[1]?.split('/')[0] || ''
    } else if (!videoId && parsed.pathname.includes('/shorts/')) {
      videoId = parsed.pathname.split('/shorts/')[1]?.split('/')[0] || ''
    } else if (!videoId && parsed.pathname.includes('/live/')) {
      videoId = parsed.pathname.split('/live/')[1]?.split('/')[0] || ''
    }
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    throw new YouTubeTranscriptError('Could not extract a valid 11-character YouTube video ID.', 400)
  }
  return videoId
}

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function decodeHtmlEntities(input: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    '#39': "'",
    '#039': "'",
    nbsp: ' ',
  }
  return input
    .replace(/&([a-zA-Z0-9#]+);/g, (full, ent: string) => {
      if (ent in named) return named[ent]
      if (ent.startsWith('#x')) {
        const code = parseInt(ent.slice(2), 16)
        return Number.isFinite(code) ? String.fromCodePoint(code) : full
      }
      if (ent.startsWith('#')) {
        const code = parseInt(ent.slice(1), 10)
        return Number.isFinite(code) ? String.fromCodePoint(code) : full
      }
      return full
    })
    .replace(/\s+/g, ' ')
    .trim()
}

interface CaptionTrack {
  baseUrl?: string
  languageCode?: string
  kind?: string
}

interface PlayerResponseShape {
  videoDetails?: {
    title?: string
    author?: string
    lengthSeconds?: string
  }
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[]
    }
  }
}

function extractBalancedJson(source: string, marker: string): PlayerResponseShape | null {
  const idx = source.indexOf(marker)
  if (idx === -1) return null
  const start = source.indexOf('{', idx + marker.length)
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, i + 1)) as PlayerResponseShape
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null
  const manualEn = tracks.find(
    (t) => t.baseUrl && t.languageCode?.startsWith('en') && t.kind !== 'asr'
  )
  if (manualEn) return manualEn
  const autoEn = tracks.find((t) => t.baseUrl && t.languageCode?.startsWith('en'))
  if (autoEn) return autoEn
  const manualAny = tracks.find((t) => t.baseUrl && t.kind !== 'asr')
  return manualAny || tracks.find((t) => Boolean(t.baseUrl)) || null
}

function parseXmlCaptions(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  const textTagRe = /<text\b([^>]*)>([\s\S]*?)<\/text>/g
  let match: RegExpExecArray | null
  while ((match = textTagRe.exec(xml)) !== null) {
    const attrs = match[1] || ''
    const startMatch = attrs.match(/start="([0-9.]+)"/)
    const seconds = startMatch ? parseFloat(startMatch[1]) : 0
    const cleaned = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, ' '))
    if (cleaned) {
      segments.push({
        time: formatTimestamp(seconds),
        seconds,
        text: cleaned,
      })
    }
  }
  return segments
}

function parseJson3Captions(rawJson: string): TranscriptSegment[] {
  try {
    const parsed = JSON.parse(rawJson) as {
      events?: Array<{
        tStartMs?: number
        segs?: Array<{ utf8?: string }>
      }>
    }
    const segments: TranscriptSegment[] = []
    for (const ev of parsed.events || []) {
      const text = decodeHtmlEntities((ev.segs || []).map((s) => s.utf8 || '').join(''))
      if (text) {
        const seconds = (ev.tStartMs || 0) / 1000
        segments.push({
          time: formatTimestamp(seconds),
          seconds,
          text,
        })
      }
    }
    return segments
  } catch {
    return []
  }
}

export async function fetchYouTubeTranscript(rawUrl: string): Promise<YouTubeTranscriptResult> {
  const videoId = extractYouTubeVideoId(rawUrl)

  const commonHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  }

  let playerData: PlayerResponseShape | null = null

  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: commonHeaders,
  })
  if (watchRes.ok) {
    const html = await watchRes.text()
    playerData =
      extractBalancedJson(html, 'var ytInitialPlayerResponse =') ||
      extractBalancedJson(html, 'ytInitialPlayerResponse =')
  }

  let tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []

  if (!tracks.length) {
    const innertubeRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.09.37',
            androidSdkVersion: 30,
            hl: 'en',
          },
        },
        videoId,
      }),
    }).catch(() => null)

    if (innertubeRes?.ok) {
      const apiPlayer = (await innertubeRes.json()) as PlayerResponseShape
      if (!playerData?.videoDetails?.title && apiPlayer.videoDetails) {
        playerData = apiPlayer
      }
      tracks = apiPlayer.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
    }
  }

  const track = pickCaptionTrack(tracks)
  if (!track?.baseUrl) {
    throw new YouTubeTranscriptError(
      'No transcript or captions are available for this YouTube video. Try a lecture video with subtitles/CC enabled.',
      422
    )
  }

  let trackUrl: URL
  try {
    trackUrl = new URL(track.baseUrl)
  } catch {
    throw new YouTubeTranscriptError('Caption track URL was invalid.', 422)
  }
  if (!trackUrl.hostname.endsWith('.youtube.com') && !trackUrl.hostname.endsWith('.googlevideo.com')) {
    throw new YouTubeTranscriptError('Unexpected caption track host.', 422)
  }

  // Try JSON3 first, fallback to default XML timedtext
  const jsonUrl = new URL(trackUrl.toString())
  jsonUrl.searchParams.set('fmt', 'json3')

  let segments: TranscriptSegment[] = []
  const jsonRes = await fetch(jsonUrl.toString(), { headers: commonHeaders }).catch(() => null)
  if (jsonRes?.ok) {
    segments = parseJson3Captions(await jsonRes.text())
  }

  if (!segments.length) {
    const xmlRes = await fetch(trackUrl.toString(), { headers: commonHeaders }).catch(() => null)
    if (xmlRes?.ok) {
      segments = parseXmlCaptions(await xmlRes.text())
    }
  }

  if (!segments.length) {
    throw new YouTubeTranscriptError(
      'Captions were found for this video, but the transcript body was empty or unavailable.',
      422
    )
  }

  const lengthSeconds = Number(playerData?.videoDetails?.lengthSeconds || 0)
  const duration = lengthSeconds > 0 ? formatTimestamp(lengthSeconds) : ''

  // Merge small caption snippets into readable ~25-40 second study chunks while keeping timestamps
  const merged: TranscriptSegment[] = []
  let currentChunk: TranscriptSegment | null = null
  for (const seg of segments) {
    if (!currentChunk) {
      currentChunk = { ...seg }
    } else if (seg.seconds - currentChunk.seconds < 22 && currentChunk.text.length < 220) {
      currentChunk.text = `${currentChunk.text} ${seg.text}`
    } else {
      merged.push(currentChunk)
      currentChunk = { ...seg }
    }
  }
  if (currentChunk) merged.push(currentChunk)

  const fullText = merged.map((s) => `[${s.time}] ${s.text}`).join('\n')

  return {
    videoId,
    title: playerData?.videoDetails?.title || 'YouTube Lecture',
    channel: playerData?.videoDetails?.author || 'YouTube',
    duration,
    segments: merged,
    fullText,
  }
}
