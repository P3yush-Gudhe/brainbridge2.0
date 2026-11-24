import { Router } from 'express'
import type { Request, Response } from 'express'
import { Type } from '@google/genai'
import type { GenerateContentResponse } from '@google/genai'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { GEMINI_MODEL, getGeminiClient, normalizeGeminiError, parseJsonResponse, withRetry } from './gemini.ts'

export const aiRouter = Router()

function sendError(res: Response, err: unknown) {
  const { status, message } = normalizeGeminiError(err)
  res.status(status).json({ error: message })
}

// 1. Quiz Generator
aiRouter.post('/quiz', async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient()
    const subject = String(req.body?.subject || 'General Knowledge').trim()
    const topic = String(req.body?.topic || '').trim()
    const difficulty = String(req.body?.difficulty || 'medium').trim()
    const type = req.body?.type === 'truefalse' ? 'truefalse' : 'mcq'
    const count = Math.min(20, Math.max(1, Number(req.body?.count) || 5))

    const topicText = topic ? `specifically focusing on "${topic}"` : 'covering core concepts'
    const formatInstruction =
      type === 'truefalse'
        ? 'Each question must be a True/False question with exactly 2 options: ["True", "False"].'
        : 'Each question must be a multiple-choice question with exactly 4 distinct options.'

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Generate ${count} ${difficulty}-difficulty ${type === 'truefalse' ? 'True/False' : 'multiple-choice'} quiz questions for the subject "${subject}" ${topicText}. ${formatInstruction} Provide the 0-based index of the correct option and a clear, concise explanation for each question.`,
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
aiRouter.post('/chat', async (req: Request, res: Response) => {
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
      model: GEMINI_MODEL,
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
aiRouter.post('/flashcards', async (req: Request, res: Response) => {
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
        model: GEMINI_MODEL,
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

// 4. PDF Document Reader (process + Q&A)
aiRouter.post('/pdf', async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient()
    const action = req.body?.action === 'chat' ? 'chat' : 'process'
    const fileBase64 = String(req.body?.fileBase64 || '').trim()
    const fileName = String(req.body?.fileName || 'document.pdf').trim()

    if (!fileBase64) {
      res.status(400).json({ error: 'PDF content is required.' })
      return
    }

    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf',
        data: fileBase64,
      },
    }

    if (action === 'chat') {
      const question = String(req.body?.question || '').trim()
      if (!question) {
        res.status(400).json({ error: 'Question is required.' })
        return
      }
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: {
            parts: [
              pdfPart,
              {
                text: `Answer the student's question based strictly on the attached PDF ("${fileName}"). Be clear, accurate, and cite relevant sections or concepts from the document.\n\nQuestion: ${question}`,
              },
            ],
          },
        })
      )
      res.json({ answer: response.text ?? '' })
      return
    }

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [
            pdfPart,
            {
              text: `Analyze the attached PDF ("${fileName}") and generate:\n1. A well-structured Markdown summary with headings, bullet points, and key formulas.\n2. 6-10 concise key points.\n3. 5 multiple-choice quiz questions based on the document.\n4. 6 study flashcards (front and back) from the document's core definitions and ideas.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              quiz: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    q: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    answer: { type: Type.INTEGER },
                  },
                  required: ['q', 'options', 'answer'],
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
            required: ['summary', 'keyPoints', 'quiz', 'flashcards'],
          },
        },
      })
    )

    const parsed = parseJsonResponse<{
      summary?: string
      keyPoints?: string[]
      quiz?: Array<{ q: string; options: string[]; answer: number }>
      flashcards?: Array<{ front: string; back: string }>
    }>(response.text, {})

    res.json({
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      quiz: Array.isArray(parsed.quiz) ? parsed.quiz : [],
      flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
    })
  } catch (err) {
    sendError(res, err)
  }
})

// 5. YouTube Learning Analyzer (uses urlContext + googleSearch grounding, then structured schema)
aiRouter.post('/youtube', async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient()
    const url = String(req.body?.url || '').trim()
    if (!url) {
      res.status(400).json({ error: 'Please provide a YouTube video URL.' })
      return
    }

    const grounded = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Analyze this educational YouTube video URL and extract its title, channel/creator, approximate duration, comprehensive study summary, key notes/principles, timestamped topic breakdown or transcript highlights, 4 quiz questions, and 6 flashcards:\n${url}`,
        config: {
          tools: [{ urlContext: {} }, { googleSearch: {} }],
        },
      })
    )

    const groundedText = grounded.text ?? ''
    if (!groundedText.trim()) {
      res.status(422).json({ error: 'Could not extract content from this YouTube URL. Please verify the link is public.' })
      return
    }

    const structured = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Convert the following video analysis into clean structured JSON:\n\n${groundedText}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              duration: { type: Type.STRING },
              channel: { type: Type.STRING },
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
              transcript: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING },
                    text: { type: Type.STRING },
                  },
                  required: ['time', 'text'],
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
            required: ['title', 'duration', 'channel', 'summary', 'notes', 'transcript', 'quiz', 'flashcards'],
          },
        },
      })
    )

    const parsed = parseJsonResponse<{
      title?: string
      duration?: string
      channel?: string
      summary?: string
      notes?: Array<{ heading: string; bullets: string[] }>
      transcript?: Array<{ time: string; text: string }>
      quiz?: Array<{ q: string; opts: string[]; ans: number }>
      flashcards?: Array<{ front: string; back: string }>
    }>(structured.text, {})

    res.json({
      title: parsed.title || 'YouTube Study Guide',
      duration: parsed.duration || '',
      channel: parsed.channel || '',
      summary: parsed.summary || groundedText,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      transcript: Array.isArray(parsed.transcript) ? parsed.transcript : [],
      quiz: Array.isArray(parsed.quiz) ? parsed.quiz : [],
      flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
    })
  } catch (err) {
    sendError(res, err)
  }
})

// 6. OCR Text Extractor & AI Actions
aiRouter.post('/ocr', async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient()
    const action = String(req.body?.action || 'extract')

    if (action === 'extract') {
      const imageBase64 = String(req.body?.imageBase64 || '').trim()
      const mimeType = String(req.body?.mimeType || 'image/png').trim()
      if (!imageBase64) {
        res.status(400).json({ error: 'Image data is required for OCR.' })
        return
      }
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: {
            parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              {
                text: 'Extract all visible text, headings, bullet points, and mathematical equations accurately from this image. Preserve line breaks and structure cleanly. Return only the extracted text.',
              },
            ],
          },
        })
      )
      res.json({ text: (response.text ?? '').trim() })
      return
    }

    const text = String(req.body?.text || '').trim()
    const targetLanguage = String(req.body?.targetLanguage || 'Spanish').trim()
    if (!text) {
      res.status(400).json({ error: 'Extracted text is required.' })
      return
    }

    const prompts: Record<string, string> = {
      summarize: `Provide a concise, well-structured summary of the following extracted study text:\n\n${text}`,
      translate: `Translate the following study text accurately into ${targetLanguage}, preserving formatting and equations:\n\n${text}`,
      notes: `Convert the following extracted text into clean, organized Markdown study notes with key takeaways and definitions:\n\n${text}`,
    }

    const prompt = prompts[action] || prompts.notes
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      })
    )
    res.json({ result: (response.text ?? '').trim() })
  } catch (err) {
    sendError(res, err)
  }
})

// 7. Notes AI Assistant
aiRouter.post('/notes', async (req: Request, res: Response) => {
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
        model: GEMINI_MODEL,
        contents: prompt,
      })
    )

    res.json({ result: (response.text ?? '').trim(), mode })
  } catch (err) {
    sendError(res, err)
  }
})

// 8. Mind Map Generator
aiRouter.post('/mindmap', async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient()
    const topic = String(req.body?.topic || '').trim()
    if (!topic) {
      res.status(400).json({ error: 'Please enter a topic to generate a mind map.' })
      return
    }

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
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

// 9. Code Playground (real execution for Python/JS/TS/C/C++ + Gemini Explain/Debug/Optimize)
function runProcess(cmd: string, args: string[], timeoutMs = 4000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 256 * 1024 }, (error, stdout, stderr) => {
      if (error && 'killed' in error && error.killed) {
        resolve({ stdout, stderr: `${stderr}\nExecution timed out after ${timeoutMs / 1000}s`, exitCode: 124 })
        return
      }
      const exitCode = typeof (error as NodeJS.ErrnoException | null)?.code === 'number'
        ? ((error as unknown as { code: number }).code ?? 1)
        : error
          ? 1
          : 0
      resolve({ stdout: stdout || '', stderr: stderr || '', exitCode })
    })
  })
}

aiRouter.post('/code', async (req: Request, res: Response) => {
  try {
    const action = String(req.body?.action || 'run')
    const language = String(req.body?.language || 'python').toLowerCase()
    const code = String(req.body?.code || '')

    if (!code.trim()) {
      res.status(400).json({ error: 'Please write some code first.' })
      return
    }

    if (action === 'run') {
      const tmpDir = path.join(os.tmpdir(), `studymate-code-${crypto.randomBytes(6).toString('hex')}`)
      await fs.mkdir(tmpDir, { recursive: true })
      try {
        let result: { stdout: string; stderr: string; exitCode: number } | null = null

        if (language === 'python') {
          const file = path.join(tmpDir, 'main.py')
          await fs.writeFile(file, code)
          result = await runProcess('python3', [file])
        } else if (language === 'javascript') {
          const file = path.join(tmpDir, 'main.mjs')
          await fs.writeFile(file, code)
          result = await runProcess('node', [file])
        } else if (language === 'typescript') {
          const file = path.join(tmpDir, 'main.ts')
          await fs.writeFile(file, code)
          result = await runProcess('node', ['--experimental-strip-types', file])
        } else if (language === 'c') {
          const src = path.join(tmpDir, 'main.c')
          const bin = path.join(tmpDir, 'main')
          await fs.writeFile(src, code)
          const compile = await runProcess('gcc', [src, '-o', bin])
          if (compile.exitCode !== 0) {
            result = compile
          } else {
            result = await runProcess(bin, [])
          }
        } else if (language === 'cpp') {
          const src = path.join(tmpDir, 'main.cpp')
          const bin = path.join(tmpDir, 'main')
          await fs.writeFile(src, code)
          const compile = await runProcess('g++', [src, '-std=c++17', '-o', bin])
          if (compile.exitCode !== 0) {
            result = compile
          } else {
            result = await runProcess(bin, [])
          }
        }

        if (result) {
          const combined = [result.stdout.trimEnd(), result.stderr.trimEnd()].filter(Boolean).join('\n\n')
          res.json({
            output: `${combined || '(No output)'}\n\nProcess finished with exit code ${result.exitCode}`,
          })
          return
        }

        // Java fallback using Gemini trace since JDK is not installed in container
        const ai = getGeminiClient()
        const response = await withRetry(() =>
          ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: `Trace and show the exact console stdout (and any compile/runtime errors if present) for this ${language} program. Return only the program output:\n\n\`\`\`${language}\n${code}\n\`\`\``,
          })
        )
        res.json({ output: (response.text ?? '').trim() })
        return
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
      }
    }

    const ai = getGeminiClient()
    const actionInstructions: Record<string, string> = {
      explain: `Explain this ${language} code clearly: how it works step by step, time complexity, and space complexity.`,
      debug: `Inspect this ${language} code for bugs, edge cases, and potential runtime errors. Provide concrete fixes if needed.`,
      optimize: `Analyze this ${language} code and suggest cleaner, faster, or more idiomatic optimizations with improved complexity or readability.`,
    }

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `${actionInstructions[action] || actionInstructions.explain}\n\n\`\`\`${language}\n${code}\n\`\`\``,
      })
    )
    res.json({ analysis: (response.text ?? '').trim() })
  } catch (err) {
    sendError(res, err)
  }
})

// 10. Study Planner AI Schedule Generator
aiRouter.post('/planner', async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient()
    const exams = Array.isArray(req.body?.exams) ? req.body.exams : []
    const existingTasks = Array.isArray(req.body?.existingTasks) ? req.body.existingTasks : []

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Given these upcoming exams:\n${JSON.stringify(exams)}\nand current tasks:\n${JSON.stringify(existingTasks)}\n\nGenerate 5 high-impact study tasks scheduled over the next 0 to 6 days (dateOffsetDays 0 = today) and a brief personalized recommendation (1-2 sentences).`,
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
