import { eq } from 'drizzle-orm'
import { db } from './index.ts'
import { users } from './schema.ts'

export type DbUser = typeof users.$inferSelect

export async function getOrCreateUser(
  uid: string,
  email: string,
  name?: string,
  avatar?: string
): Promise<DbUser> {
  try {
    const safeEmail = email || `${uid}@user.local`
    const safeName = (name && name.trim()) || safeEmail.split('@')[0] || 'Student'
    const result = await db
      .insert(users)
      .values({
        uid,
        email: safeEmail,
        name: safeName,
        avatar: avatar || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: safeEmail,
          updatedAt: new Date(),
        },
      })
      .returning()

    return result[0]
  } catch (error) {
    console.error('Database user upsert failed:', error)
    throw new Error('Failed to synchronize user account. Please try again later.', { cause: error })
  }
}

export async function getUserByUid(uid: string): Promise<DbUser | null> {
  try {
    const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1)
    return result[0] ?? null
  } catch (error) {
    console.error('Database user lookup failed:', error)
    throw new Error('Database query failed. Please try again later.', { cause: error })
  }
}

export async function updateUserProfile(
  userId: number,
  updates: {
    name?: string
    bio?: string
    university?: string
    year?: string
    avatar?: string | null
  }
): Promise<DbUser> {
  try {
    const result = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning()

    if (!result[0]) {
      throw new Error('User record not found')
    }
    return result[0]
  } catch (error) {
    console.error('Database user profile update failed:', error)
    throw new Error('Failed to update profile. Please try again later.', { cause: error })
  }
}

export async function deleteUserById(userId: number): Promise<void> {
  try {
    await db.delete(users).where(eq(users.id, userId))
  } catch (error) {
    console.error('Database user deletion failed:', error)
    throw new Error('Failed to delete account. Please try again later.', { cause: error })
  }
}
