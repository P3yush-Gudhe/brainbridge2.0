import type { NextFunction, Request, Response } from 'express'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { getOrCreateUser, type DbUser } from '../db/users.ts'
import { adminAuth } from '../lib/firebase-admin.ts'

export interface AuthRequest extends Request {
  user?: DecodedIdToken
  dbUser?: DbUser
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing token' })
    return
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing token' })
    return
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token)
    req.user = decodedToken
    req.dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || '',
      decodedToken.name,
      decodedToken.picture
    )
    next()
  } catch (error) {
    console.error('Error verifying Firebase ID token or syncing user:', error)
    res.status(401).json({ error: 'Unauthorized: Invalid token' })
  }
}
