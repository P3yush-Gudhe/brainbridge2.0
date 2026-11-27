import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { Skeleton, SkeletonGrid } from '@/components/ui/Skeleton'

const LandingPage = lazy(() => import('@/pages/LandingPage').then(m => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then(m => ({ default: m.RegisterPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const AIChatPage = lazy(() => import('@/pages/AIChatPage').then(m => ({ default: m.AIChatPage })))
const AITutorPage = lazy(() => import('@/pages/AITutorPage').then(m => ({ default: m.AITutorPage })))
const PDFReaderPage = lazy(() => import('@/pages/PDFReaderPage').then(m => ({ default: m.PDFReaderPage })))
const NotesPage = lazy(() => import('@/pages/NotesPage').then(m => ({ default: m.NotesPage })))
const FlashcardsPage = lazy(() => import('@/pages/FlashcardsPage').then(m => ({ default: m.FlashcardsPage })))
const QuizPage = lazy(() => import('@/pages/QuizPage').then(m => ({ default: m.QuizPage })))
const StudyPlannerPage = lazy(() => import('@/pages/StudyPlannerPage').then(m => ({ default: m.StudyPlannerPage })))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })))
const AttendancePage = lazy(() => import('@/pages/AttendancePage').then(m => ({ default: m.AttendancePage })))
const CGPAPage = lazy(() => import('@/pages/CGPAPage').then(m => ({ default: m.CGPAPage })))
const CodePlaygroundPage = lazy(() => import('@/pages/CodePlaygroundPage').then(m => ({ default: m.CodePlaygroundPage })))
const YouTubeLearningPage = lazy(() => import('@/pages/YouTubeLearningPage').then(m => ({ default: m.YouTubeLearningPage })))
const OCRScannerPage = lazy(() => import('@/pages/OCRScannerPage').then(m => ({ default: m.OCRScannerPage })))
const VoiceAssistantPage = lazy(() => import('@/pages/VoiceAssistantPage').then(m => ({ default: m.VoiceAssistantPage })))
const PomodoroPage = lazy(() => import('@/pages/PomodoroPage').then(m => ({ default: m.PomodoroPage })))
const MindMapPage = lazy(() => import('@/pages/MindMapPage').then(m => ({ default: m.MindMapPage })))
const AchievementsPage = lazy(() => import('@/pages/AchievementsPage').then(m => ({ default: m.AchievementsPage })))
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })))
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const SearchPage = lazy(() => import('@/pages/SearchPage').then(m => ({ default: m.SearchPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

function PageLoadingFallback() {
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 bg-bg min-h-full">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <SkeletonGrid count={3} />
    </div>
  )
}

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center text-text-secondary text-sm">
      Loading workspace...
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return <AuthLoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return <AuthLoadingScreen />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  const initAuth = useAuthStore((s) => s.initAuth)

  useEffect(() => {
    const unsubscribe = initAuth()
    return () => unsubscribe()
  }, [initAuth])

  return (
    <MotionConfig reducedMotion="user">
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

          {/* Protected app routes */}
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="chat" element={<AIChatPage />} />
            <Route path="ai-tutor" element={<AITutorPage />} />
            <Route path="pdf" element={<PDFReaderPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="flashcards" element={<FlashcardsPage />} />
            <Route path="quiz" element={<QuizPage />} />
            <Route path="planner" element={<StudyPlannerPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="cgpa" element={<CGPAPage />} />
            <Route path="code" element={<CodePlaygroundPage />} />
            <Route path="youtube" element={<YouTubeLearningPage />} />
            <Route path="ocr" element={<OCRScannerPage />} />
            <Route path="voice" element={<VoiceAssistantPage />} />
            <Route path="pomodoro" element={<PomodoroPage />} />
            <Route path="mindmap" element={<MindMapPage />} />
            <Route path="achievements" element={<AchievementsPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="search" element={<SearchPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </MotionConfig>
  )
}
