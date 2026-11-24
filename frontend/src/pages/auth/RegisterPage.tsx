import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bookmark, ShieldCheck } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'

export function RegisterPage() {
  const [signingIn, setSigningIn] = useState(false)
  const navigate = useNavigate()
  const { signInWithGoogle } = useAuthStore()

  const handleGoogleSignUp = async () => {
    setSigningIn(true)
    try {
      const user = await signInWithGoogle()
      toast.success(`Welcome to StudyMate, ${user.name}!`)
      navigate('/dashboard')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Google Sign-In failed'
      if (!msg.includes('popup-closed-by-user')) {
        toast.error(msg)
      }
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center p-6 text-[#252525]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm bg-white border border-[#E7E5E0] rounded-2xl p-7 shadow-xs"
      >
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 rounded-md bg-[#5965B3] text-white flex items-center justify-center">
            <Bookmark className="w-4 h-4 fill-white/20" />
          </div>
          <span className="text-base font-semibold text-[#252525] tracking-tight">StudyMate</span>
        </div>

        <h1 className="text-2xl font-bold text-[#252525] mb-1 tracking-tight">Get started</h1>
        <p className="text-xs text-[#707070] mb-6">Create your StudyMate workspace in one click with Google</p>

        <Button
          onClick={handleGoogleSignUp}
          isLoading={signingIn}
          size="lg"
          variant="secondary"
          className="w-full justify-center gap-2.5 bg-white border border-[#E7E5E0] hover:border-[#D4D2CD] text-[#252525]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </Button>

        <div className="mt-5 pt-5 border-t border-[#E7E5E0] flex items-center gap-2 text-[11px] text-[#707070]">
          <ShieldCheck className="w-4 h-4 text-[#5C8A6A] flex-shrink-0" />
          <span>Instant workspace setup — your study data syncs automatically across sessions.</span>
        </div>

        <p className="text-center text-xs text-[#707070] mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-[#5965B3] hover:underline font-semibold">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
