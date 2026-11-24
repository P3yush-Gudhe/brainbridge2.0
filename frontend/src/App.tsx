import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { AIChatPage } from '@/pages/AIChatPage'
import { PDFReaderPage } from '@/pages/PDFReaderPage'
import { NotesPage } from '@/pages/NotesPage'
import { FlashcardsPage } from '@/pages/FlashcardsPage'
import { QuizPage } from '@/pages/QuizPage'
import { StudyPlannerPage } from '@/pages/StudyPlannerPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { AttendancePage } from '@/pages/AttendancePage'
import { CGPAPage } from '@/pages/CGPAPage'
import { CodePlaygroundPage } from '@/pages/CodePlaygroundPage'
import { YouTubeLearningPage } from '@/pages/YouTubeLearningPage'
import { OCRScannerPage } from '@/pages/OCRScannerPage'
import { VoiceAssistantPage } from '@/pages/VoiceAssistantPage'
import { PomodoroPage } from '@/pages/PomodoroPage'
import { AchievementsPage } from '@/pages/AchievementsPage'
import { LeaderboardPage } from '@/pages/LeaderboardPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SearchPage } from '@/pages/SearchPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AITutorPage } from '@/pages/AITutorPage'
import { MindMapPage } from '@/pages/MindMapPage'

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center text-[#707070] text-sm">
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
  )
}
