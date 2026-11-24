import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Bookmark, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import api from '@/lib/api'

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
})

type FormData = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      await api.post('/auth/forgot-password', { email: data.email })
      setSubmitted(true)
    } catch {
      toast.error('Failed to send reset email. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center p-6 text-[#252525]">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 rounded-md bg-[#5965B3] text-white flex items-center justify-center">
            <Bookmark className="w-4 h-4 fill-white/20" />
          </div>
          <span className="text-base font-semibold text-[#252525] tracking-tight">StudyMate</span>
        </div>

        {submitted ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 bg-white border border-[#E7E5E0] rounded-xl p-6 shadow-xs">
            <CheckCircle2 className="w-8 h-8 text-[#5C8A6A] mx-auto mb-3" />
            <h2 className="text-lg font-bold text-[#252525] mb-1">Check your inbox</h2>
            <p className="text-xs text-[#707070] mb-6">
              We sent a password reset link to <strong className="text-[#252525]">{getValues('email')}</strong>.
            </p>
            <Link to="/login">
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>Back to login</Button>
            </Link>
          </motion.div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-[#252525] mb-1 tracking-tight">Reset password</h1>
            <p className="text-xs text-[#707070] mb-6">Enter your email and we'll send you a recovery link</p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input id="forgot-email" label="Email address" type="email" placeholder="you@example.com" leftIcon={<Mail className="w-4 h-4 text-[#707070]" />} error={errors.email?.message} {...register('email')} />
              <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full">Send reset link</Button>
            </form>
            <p className="text-center text-xs text-[#707070] mt-6">
              <Link to="/login" className="text-[#5965B3] hover:underline font-semibold flex items-center justify-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to login
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  )
}
