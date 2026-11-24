import { create } from 'zustand'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleAuthProvider } from '@/lib/firebase'

export interface User {
  id: string
  uid: string
  name: string
  email: string
  avatar?: string | null
  bio?: string
  university?: string
  year?: string
  role: 'student' | 'admin'
  streak: number
  xp: number
  level: number
  joinedAt: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  initAuth: () => () => void
  signInWithGoogle: () => Promise<User>
  refreshSessionUser: () => Promise<void>
  logout: () => Promise<void>
  updateUser: (updates: Partial<User>) => void
}

async function syncUserWithBackend(idToken: string): Promise<Partial<User> | null> {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${idToken}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      user?: {
        id: number
        uid: string
        name: string
        email: string
        avatar?: string | null
        bio?: string
        university?: string
        year?: string
        streak?: number
        xp?: number
        level?: number
        createdAt?: string
      }
    }
    if (!data.user) return null
    return {
      id: String(data.user.id),
      uid: data.user.uid,
      name: data.user.name,
      email: data.user.email,
      avatar: data.user.avatar ?? null,
      bio: data.user.bio ?? '',
      university: data.user.university ?? '',
      year: data.user.year ?? '',
      streak: data.user.streak ?? 1,
      xp: data.user.xp ?? 0,
      level: data.user.level ?? 1,
      joinedAt: data.user.createdAt
        ? new Date(data.user.createdAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    }
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initAuth: () => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null })
        return
      }
      try {
        const idToken = await fbUser.getIdToken()
        const synced = await syncUserWithBackend(idToken)
        const user: User = {
          id: synced?.id ?? fbUser.uid,
          uid: fbUser.uid,
          name: synced?.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'Student',
          email: synced?.email || fbUser.email || '',
          avatar: synced?.avatar ?? fbUser.photoURL,
          bio: synced?.bio ?? '',
          university: synced?.university ?? '',
          year: synced?.year ?? '',
          role: 'student',
          streak: synced?.streak ?? 1,
          xp: synced?.xp ?? 0,
          level: synced?.level ?? 1,
          joinedAt: synced?.joinedAt ?? new Date().toISOString().slice(0, 10),
        }
        set({ user, token: idToken, isAuthenticated: true, isLoading: false, error: null })
      } catch (err) {
        console.error('Auth initialization failed:', err)
        set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: 'Authentication failed' })
      }
    })
    return unsubscribe
  },

  signInWithGoogle: async () => {
    set({ error: null })
    const credential = await signInWithPopup(auth, googleAuthProvider)
    const fbUser = credential.user
    const idToken = await fbUser.getIdToken()
    const synced = await syncUserWithBackend(idToken)
    const user: User = {
      id: synced?.id ?? fbUser.uid,
      uid: fbUser.uid,
      name: synced?.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'Student',
      email: synced?.email || fbUser.email || '',
      avatar: synced?.avatar ?? fbUser.photoURL,
      bio: synced?.bio ?? '',
      university: synced?.university ?? '',
      year: synced?.year ?? '',
      role: 'student',
      streak: synced?.streak ?? 1,
      xp: synced?.xp ?? 0,
      level: synced?.level ?? 1,
      joinedAt: synced?.joinedAt ?? new Date().toISOString().slice(0, 10),
    }
    set({ user, token: idToken, isAuthenticated: true, isLoading: false, error: null })
    return user
  },

  refreshSessionUser: async () => {
    const fbUser = auth.currentUser
    if (!fbUser) return
    const idToken = await fbUser.getIdToken()
    const synced = await syncUserWithBackend(idToken)
    if (synced) {
      const current = get().user
      set({
        token: idToken,
        user: current ? { ...current, ...synced } : null,
      })
    }
  },

  logout: async () => {
    await signOut(auth)
    set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null })
  },

  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
}))
