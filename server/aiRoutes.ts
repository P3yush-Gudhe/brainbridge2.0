import { Router } from 'express'
import type { Response } from 'express'
import { Type } from '@google/genai'
import type { GenerateContentResponse } from '@google/genai'
import type { AuthRequest } from '../src/middleware/auth.ts'
import { getGeminiClient, getGeminiModel, normalizeGeminiError, parseJsonResponse, withRetry } from './gemini.ts'
import { CodeRunnerError, executeSandboxedCode } from './codeRunner.ts'
import { handleOcrAnalysis, handlePdfAnalysis } from './uploadRoutes.ts'
import {
  aiChatSchema,
  aiCodeSchema,
  aiFlashcardsSchema,
  aiMindMapSchema,
  aiNotesSchema,
  aiOcrSchema,
  aiPdfSchema,
  aiPlannerSchema,
  aiQuizSchema,
  aiYoutubeSchema,
  validateBody,
} from './validation.ts'
import { fetchYouTubeTranscript, YouTubeTranscriptError } from './youtube.ts'
import { getWeeklySummaryContext } from '../src/db/workspace.ts'

export const aiRouter = Router()

function sendError(res: Response, err: unknown) {
  if (err instanceof CodeRunnerError) {
    if (err.retryAfterSeconds) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds))
    }
    res.status(err.status).json({ error: err.message })
    return
  }
  if (err instanceof YouTubeTranscriptError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  const { status, message } = normalizeGeminiError(err)
  res.status(status).json({ error: message })
}

// 1. Quiz Generator
aiRouter.post('/quiz', validateBody(aiQuizSchema), async (req: AuthRequest, res: Response) => {
  try {
    const ai = getGeminiClient()
    const subject = String(req.body?.subject || 'General Knowledge').trim()
    const topic = String(req.body?.topic || '').trim()
    const sourceText = String(req.body?.sourceText || '').trim()
    const difficulty = String(req.body?.difficulty || 'medium').trim()
    const type = req.body?.type === 'truefalse' ? 'truefalse' : 'mcq'
    const count = Math.min(20, Math.max(1, Number(req.body?.count) || 5))

    const topicText = topic ? `specifically focusing on "${topic}"` : 'covering core concepts'
    const formatInstruction =
      type === 'truefalse'
        ? 'Each question must be a True/False question with exactly 2 options: ["True", "False"].'
        : 'Each question must be a multiple-choice question with exactly 4 distinct options.'
    const promptBody = sourceText
      ? `Generate ${count} ${difficulty}-difficulty ${type === 'truefalse' ? 'True/False' : 'multiple-choice'} quiz questions grounded in the following study material for "${subject}" ${topicText}.\n\nStudy Material:\n${sourceText.slice(0, 12000)}\n\n${formatInstruction} Provide the 0-based index of the correct option and a clear, concise explanation for each question.`
      : `Generate ${count} ${difficulty}-difficulty ${type === 'truefalse' ? 'True/False' : 'multiple-choice'} quiz questions for the subject "${subject}" ${topicText}. ${formatInstruction} Provide the 0-based index of the correct option and a clear, concise explanation for each question.`

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: getGeminiModel(),
        contents: promptBody,
        config: {
          systemInstruction:
            'You are an expert academic quiz creator. Produce accurate, unambiguous questions with clear explanations and zero duplicate questions.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING, description: 'The quiz question text.' },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Answer options (4 for MCQ, 2 for True/False).',
                },
                correct: {
                  type: Type.INTEGER,
                  description: '0-based index of the correct option.',
                },
                explanation: {
                  type: Type.STRING,
                  description: 'Concise explanation of why the correct option is right.',
                },
              },
              required: ['question', 'options', 'correct', 'explanation'],
            },
          },
        },
      })
    )

    const raw = parseJsonResponse<
      Array<{
        question?: string
        options?: string[]
        correct?: number
        explanation?: string
      }>
    >(response.text, [])

    const questions = raw
      .filter((q) => typeof q?.question === 'string' && q.question.trim().length > 0)
      .map((q, idx) => {
        const opts = Array.isArray(q.options) && q.options.length > 0 ? q.options.map(String) : ['True', 'False']
        return {
          id: `${Date.now()}-${idx}`,
          question: q.question!.trim(),
          options: opts,
          correct:
            typeof q.correct === 'number' && q.correct >= 0 && q.correct < opts.length
              ? q.correct
              : 0,
          explanation: typeof q.explanation === 'string' ? q.explanation : '',
        }
      })

    if (!questions.length) {
      res.status(502).json({ error: 'Quiz generator returned an empty response. Please try again.' })
      return
    }

    res.json({ questions })
  } catch (err) {
    sendError(res, err)
  }
})

// 2. AI Chat & Tutor & Voice (supports SSE streaming or JSON)
aiRouter.post('/chat', validateBody(aiChatSchema), async (req: AuthRequest, res: Response) => {
  try {
    const ai = getGeminiClient()
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
    const subject = req.body?.subject ? String(req.body.subject) : ''
    const topic = req.body?.topic ? String(req.body.topic) : ''
    const stream = req.body?.stream !== false
    const concise = Boolean(req.body?.concise)

    const lastMsg = messages[messages.length - 1]
    const promptText = String(lastMsg?.content || req.body?.prompt || '').trim()
    if (!promptText) {
      res.status(400).json({ error: 'Message content is required' })
      return
    }

    const systemInstruction = [
      'You are StudyMate, an encouraging, clear, and rigorous academic tutor.',
      subject ? `Current subject focus: ${subject}.` : '',
      topic ? `Current topic focus: ${topic}.` : '',
      concise
        ? 'Keep your response concise, natural to speak aloud (2-4 clear sentences), and free of excessive markdown tables.'
        : 'Format responses cleanly using Markdown, LaTeX math ($...$ / $$...$$), and fenced code blocks when helpful.',
    ]
      .filter(Boolean)
      .join(' ')

    const rawHistory = messages
      .slice(0, -1)
      .filter((m: { content?: string }) => typeof m?.content === 'string' && m.content.trim().length > 0)
      .map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content).trim() }],
      }))

    while (rawHistory.length > 0 && rawHistory[0].role === 'model') {
      rawHistory.shift()
    }
    const history = rawHistory

    const chat = ai.chats.create({
      model: getGeminiModel(),
      history,
      config: { systemInstruction },
    })

    if (!stream) {
      const response = await withRetry(() => chat.sendMessage({ message: promptText }))
      res.json({ reply: response.text ?? '' })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const streamRes = await chat.sendMessageStream({ message: promptText })
    for await (const chunk of streamRes) {
      const c = chunk as GenerateContentResponse
      if (c.text) {
        res.write(`data: ${JSON.stringify({ text: c.text })}\n\n`)
      }
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    if (res.headersSent) {
      const { message } = normalizeGeminiError(err)
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`)
      res.end()
    } else {
      sendError(res, err)
    }
  }
})

// 3. Flashcard Generator
aiRouter.post('/flashcards', validateBody(aiFlashcardsSchema), async (req: AuthRequest, res: Response) => {
  try {
    const ai = getGeminiClient()
    const topic = String(req.body?.topic || '').trim()
    const subject = String(req.body?.subject || 'General').trim()
    const sourceText = String(req.body?.sourceText || '').trim()
    const count = Math.min(20, Math.max(3, Number(req.body?.count) || 8))

    if (!topic && !sourceText) {
      res.status(400).json({ error: 'Please provide a topic or study material to generate flashcards.' })
      return
    }

    const prompt = sourceText
      ? `Generate ${count} high-yield study flashcards from the following ${subject} study material${topic ? ` (${topic})` : ''}:\n\n${sourceText.slice(0, 12000)}`
      : `Generate ${count} high-yield study flashcards for the subject "${subject}" on the topic "${topic}".`

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: getGeminiModel(),
        contents: prompt,
        config: {
          systemInstruction:
            'Create concise, active-recall flashcards. Each front should ask one focused question or prompt a key term; each back should give a crisp, accurate answer.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                front: { type: Type.STRING },
                back: { type: Type.STRING },
              },
              required: ['front', 'back'],
            },
          },
        },
      })
    )

    const rawCards = parseJsonResponse<Array<{ front?: string; back?: string }>>(response.text, [])
    const cards = rawCards.filter(
      (c): c is { front: string; back: string } =>
        Boolean(c && typeof c.front === 'string' && c.front.trim() && typeof c.back === 'string' && c.back.trim())
    )
    res.json({ cards })
  } catch (err) {
    sendError(res, err)
  }
})

// 4. PDF Document Reader (process + Q&A citing page numbers)
aiRouter.post('/pdf', validateBody(aiPdfSchema), handlePdfAnalysis)

// 5. YouTube Learning Analyzer (fetches real captions/transcript first, then summarizes via Gemini)
aiRouter.post('/youtube', validateBody(aiYoutubeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const url = String(req.body.url || '').trim()

    const transcriptData = await fetchYouTubeTranscript(url)
    const ai = getGeminiClient()

    const structured = await withRetry(() =>
      ai.models.generateContent({
        model: getGeminiModel(),
        contents: `You are an expert academic study assistant. Analyze ONLY the real YouTube lecture transcript below and generate a structured study guide.

Video Title: ${transcriptData.title}
Channel: ${transcriptData.channel}
Duration: ${transcriptData.duration || 'Unknown'}

Transcript:
${transcriptData.fullText.slice(0, 28000)}

Produce:
1. A comprehensive Markdown study summary highlighting core takeaways and equations.
2. 3-5 structured note sections with headings and concise bullet points.
3. 4 multiple-choice quiz questions testing comprehension of the transcript (with 4 options each and 0-based answer index).
4. 6 active-recall flashcards (front/back) grounded in this lecture.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              notes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    heading: { type: Type.STRING },
                    bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['heading', 'bullets'],
                },
              },
              quiz: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    q: { type: Type.STRING },
                    opts: { type: Type.ARRAY, items: { type: Type.STRING } },
                    ans: { type: Type.INTEGER },
                  },
                  required: ['q', 'opts', 'ans'],
                },
              },
              flashcards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    front: { type: Type.STRING },
                    back: { type: Type.STRING },
                  },
                  required: ['front', 'back'],
                },
              },
            },
            required: ['summary', 'notes', 'quiz', 'flashcards'],
          },
        },
      })
    )

    const parsed = parseJsonResponse<{
      summary?: string
      notes?: Array<{ heading: string; bullets: string[] }>
      quiz?: Array<{ q: string; opts: string[]; ans: number }>
      flashcards?: Array<{ front: string; back: string }>
    }>(structured.text, {})

    res.json({
      title: transcriptData.title,
      duration: transcriptData.duration,
      channel: transcriptData.channel,
      summary: parsed.summary || 'Summary generated from transcript.',
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      transcript: transcriptData.segments.map((s) => ({ time: s.time, text: s.text })),
      quiz: Array.isArray(parsed.quiz) ? parsed.quiz : [],
      flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
    })
  } catch (err) {
    sendError(res, err)
  }
})

// 6. OCR Text Extractor & AI Actions
aiRouter.post('/ocr', validateBody(aiOcrSchema), handleOcrAnalysis)

// 7. Notes AI Assistant
aiRouter.post('/notes', validateBody(aiNotesSchema), async (req: AuthRequest, res: Response) => {
  try {
    const ai = getGeminiClient()
    const action = String(req.body?.action || 'summarize')
    const title = String(req.body?.title || 'Untitled Note').trim()
    const content = String(req.body?.content || '').trim()
    const targetLanguage = String(req.body?.targetLanguage || 'Spanish').trim()

    let prompt = ''
    let mode: 'replace' | 'append' = 'replace'

    if (action === 'generate') {
      prompt = `Write comprehensive, well-structured Markdown study notes titled "${title}".${content ? ` Incorporate and expand on these draft points:\n${content}` : ' Include key concepts, clear explanations, examples, and formulas where relevant.'}`
      mode = 'replace'
    } else if (action === 'improve') {
      if (!content) {
        res.status(400).json({ error: 'Write some note content first before improving it.' })
        return
      }
      prompt = `Improve the clarity, structure, grammar, and Markdown formatting of these study notes titled "${title}" without losing any key information:\n\n${content}`
      mode = 'replace'
    } else if (action === 'translate') {
      if (!content) {
        res.status(400).json({ error: 'Write some note content first before translating.' })
        return
      }
      prompt = `Translate the following Markdown study notes into ${targetLanguage}, preserving all Markdown formatting and math expressions:\n\n${content}`
      mode = 'replace'
    } else {
      if (!content) {
        res.status(400).json({ error: 'Write some note content first before summarizing.' })
        return
      }
      prompt = `Create a concise "## Key Summary" Markdown section summarizing the core takeaways of these notes titled "${title}":\n\n${content}`
      mode = 'append'
    }

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: getGeminiModel(),
        contents: prompt,
      })
    )

    res.json({ result: (response.text ?? '').trim(), mode })
  } catch (err) {
    sendError(res, err)
  }
})

// 8. Mind Map Generator
aiRouter.post('/mindmap', validateBody(aiMindMapSchema), async (req: AuthRequest, res: Response) => {
  try {
    const ai = getGeminiClient()
    const topic = String(req.body?.topic || '').trim()
    if (!topic) {
      res.status(400).json({ error: 'Please enter a topic to generate a mind map.' })
      return
    }

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: getGeminiModel(),
        contents: `Create a structured academic concept mind map for the topic "${topic}". Include 4 main branches, each with 4 concise, high-value subtopics.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              root: { type: Type.STRING },
              branches: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    children: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['title', 'children'],
                },
              },
            },
            required: ['root', 'branches'],
          },
        },
      })
    )

    const parsed = parseJsonResponse<{
      root?: string
      branches?: Array<{ title: string; children: string[] }>
    }>(response.text, {})
    res.json({
      root: parsed.root || topic,
      branches: Array.isArray(parsed.branches) ? parsed.branches : [],
    })
  } catch (err) {
    sendError(res, err)
  }
})

// 9. Code Playground (isolated sandboxed execution + Gemini Explain/Debug/Optimize)
aiRouter.post('/code', validateBody(aiCodeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const action = String(req.body?.action || 'run')
    const language = String(req.body?.language || 'python').toLowerCase()
    const code = String(req.body?.code || '')

    if (!code.trim()) {
      res.status(400).json({ error: 'Please write some code first.' })
      return
    }

    if (action === 'run') {
      const userKey = req.dbUser?.uid || req.user?.uid || req.ip || 'anonymous'
      const result = await executeSandboxedCode(userKey, language, code)
      const combined = [result.stdout.trimEnd(), result.stderr.trimEnd()].filter(Boolean).join('\n\n')
      res.json({
        output: `${combined || '(No output)'}\n\n[${result.driver}] Process finished with exit code ${result.exitCode}`,
        exitCode: result.exitCode,
        driver: result.driver,
      })
      return
    }

    const ai = getGeminiClient()
    const actionInstructions: Record<string, string> = {
      explain: `Explain this ${language} code clearly: how it works step by step, time complexity, and space complexity.`,
      debug: `Inspect this ${language} code for bugs, edge cases, and potential runtime errors. Provide concrete fixes if needed.`,
      optimize: `Analyze this ${language} code and suggest cleaner, faster, or more idiomatic optimizations with improved complexity or readability.`,
    }

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: getGeminiModel(),
        contents: `${actionInstructions[action] || actionInstructions.explain}\n\n\`\`\`${language}\n${code}\n\`\`\``,
      })
    )
    res.json({ analysis: (response.text ?? '').trim() })
  } catch (err) {
    sendError(res, err)
  }
})

// 10. Study Planner AI Schedule Generator
aiRouter.post('/planner', validateBody(aiPlannerSchema), async (req: AuthRequest, res: Response) => {
  try {
    const ai = getGeminiClient()
    const exams = Array.isArray(req.body?.exams) ? req.body.exams : []
    const existingTasks = Array.isArray(req.body?.existingTasks) ? req.body.existingTasks : []

    const todayIso = new Date().toISOString().slice(0, 10)
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: getGeminiModel(),
        contents: `Today is ${todayIso}. Given these upcoming exams (prioritize exams with earlier dates and higher hoursNeeded):\n${JSON.stringify(exams)}\nand current tasks:\n${JSON.stringify(existingTasks)}\n\nGenerate 5 to 7 high-impact, realistic study tasks scheduled across day offsets 0 to 6 (dateOffsetDays 0 = today, 1 = tomorrow, etc., weighted heavily toward the nearest exam deadlines) and a concise recommendation (1-2 sentences).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendation: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    subject: { type: Type.STRING },
                    topic: { type: Type.STRING },
                    dateOffsetDays: { type: Type.INTEGER },
                    duration: { type: Type.INTEGER },
                  },
                  required: ['subject', 'topic', 'dateOffsetDays', 'duration'],
                },
              },
            },
            required: ['recommendation', 'tasks'],
          },
        },
      })
    )

    const parsed = parseJsonResponse<{
      recommendation?: string
      tasks?: Array<{ subject: string; topic: string; dateOffsetDays: number; duration: number }>
    }>(response.text, {})
    res.json({
      recommendation: parsed.recommendation || '',
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    })
  } catch (err) {
    sendError(res, err)
  }
})

// 11. Weekly AI Study Coach Summary
aiRouter.post('/weekly-summary', async (req: AuthRequest, res: Response) => {
  try {
    const ai = getGeminiClient()
    const stats = await getWeeklySummaryContext(req.dbUser!.id)

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: getGeminiModel(),
        contents: `You are StudyMate's supportive academic coach. Review this student's real past-7-days activity metrics and write a short, motivating Markdown weekly summary (under 180 words) with:
1. Highlights of what went well
2. Any weak quiz topics or due flashcards that need attention
3. Three specific, actionable goals for the coming week.

Metrics:
${JSON.stringify(stats, null, 2)}`,
      })
    )

    res.json({
      summary: (response.text ?? '').trim(),
      metrics: stats,
    })
  } catch (err) {
    sendError(res, err)
  }
})
