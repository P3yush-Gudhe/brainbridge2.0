import { Router } from 'express'
import type { Response } from 'express'
import { Type } from '@google/genai'
import type { AuthRequest } from '../src/middleware/auth.ts'
import { getGeminiClient, getGeminiModel, normalizeGeminiError, parseJsonResponse, withRetry } from './gemini.ts'
import { aiOcrSchema, aiPdfSchema, validateBody } from './validation.ts'

export const uploadRouter = Router()

const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])

export async function handlePdfAnalysis(req: AuthRequest, res: Response) {
  try {
    const ai = getGeminiClient()
    const action = req.body.action === 'chat' ? 'chat' : 'process'
    const fileBase64 = typeof req.body.fileBase64 === 'string' ? req.body.fileBase64.trim() : ''
    const extractedText = typeof req.body.extractedText === 'string' ? req.body.extractedText.trim() : ''
    const fileName = String(req.body.fileName || 'document.pdf').trim()

    if (!fileBase64 && !extractedText) {
      res.status(400).json({ error: 'PDF content is required.' })
      return
    }

    const docParts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = []
    if (fileBase64) {
      docParts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: fileBase64,
        },
      })
    } else {
      docParts.push({
        text: `Document text for "${fileName}":\n\n${extractedText.slice(0, 60000)}`,
      })
    }

    if (action === 'chat') {
      const question = String(req.body.question || '').trim()
      if (!question) {
        res.status(400).json({ error: 'Question is required.' })
        return
      }
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: getGeminiModel(),
          contents: {
            parts: [
              ...docParts,
              ...(fileBase64 && extractedText
                ? [{ text: `Page-indexed text reference:\n${extractedText.slice(0, 24000)}` }]
                : []),
              {
                text: `Answer the student's question based strictly on the attached PDF ("${fileName}"). Always cite the relevant page numbers using [Page X] format whenever referencing facts or quotes from the document.\n\nQuestion: ${question}`,
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
        model: getGeminiModel(),
        contents: {
          parts: [
            ...docParts,
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
    const { status, message } = normalizeGeminiError(err)
    res.status(status).json({ error: message })
  }
}

export async function handleOcrAnalysis(req: AuthRequest, res: Response) {
  try {
    const ai = getGeminiClient()
    const action = req.body.action || 'extract'

    if (action === 'extract') {
      const imageBase64 = String(req.body.imageBase64 || '').trim()
      const mimeType = String(req.body.mimeType || 'image/png').trim().toLowerCase()
      if (!imageBase64) {
        res.status(400).json({ error: 'Image data is required for OCR.' })
        return
      }
      if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
        res.status(400).json({ error: 'Unsupported image MIME type. Please upload PNG, JPEG, WEBP, or GIF.' })
        return
      }
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: getGeminiModel(),
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

    const text = String(req.body.text || '').trim()
    const targetLanguage = String(req.body.targetLanguage || 'Spanish').trim()
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
        model: getGeminiModel(),
        contents: prompt,
      })
    )
    res.json({ result: (response.text ?? '').trim() })
  } catch (err) {
    const { status, message } = normalizeGeminiError(err)
    res.status(status).json({ error: message })
  }
}

uploadRouter.post('/pdf', validateBody(aiPdfSchema), handlePdfAnalysis)
uploadRouter.post('/image', validateBody(aiOcrSchema), handleOcrAnalysis)
