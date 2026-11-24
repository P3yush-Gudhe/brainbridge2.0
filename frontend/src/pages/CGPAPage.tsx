import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Target, GraduationCap } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from 'react-hot-toast'
import api from '@/lib/api'

const GRADE_POINTS: Record<string, number> = {
  'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'P': 4, 'F': 0
}

const GRADE_OPTIONS = Object.keys(GRADE_POINTS)

interface Subject {
  id: number
  name: string
  credits: number
  grade: string
}

interface Semester {
  id: number
  name: string
  subjects: Subject[]
}

function calcSGPA(subjects: Subject[]): number {
  const totalPoints = subjects.reduce((sum, s) => sum + (GRADE_POINTS[s.grade] || 0) * s.credits, 0)
  const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0)
  return totalCredits > 0 ? totalPoints / totalCredits : 0
}

function calcCGPA(semesters: Semester[]): number {
  const allSubjects = semesters.flatMap(s => s.subjects)
  return calcSGPA(allSubjects)
}

export function CGPAPage() {
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [targetCGPA, setTargetCGPA] = useState('9.0')
  const [remainingSemesters, setRemainingSemesters] = useState('4')
  const patchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        setLoadError(null)
        const res = await api.get('/cgpa/semesters')
        if (!active) return
        setSemesters((res.data?.semesters || []) as Semester[])
      } catch (error: unknown) {
        if (!active) return
        const err = error as { response?: { data?: { error?: string } }; message?: string }
        setLoadError(err.response?.data?.error || err.message || 'Failed to load semesters')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const cgpa = calcCGPA(semesters)

  const addSemester = async () => {
    try {
      const res = await api.post('/cgpa/semesters', { name: `Semester ${semesters.length + 1}` })
      const created = res.data.semester as Semester
      setSemesters(s => [...s, created])
      toast.success('Semester added')
    } catch {
      toast.error('Failed to add semester')
    }
  }

  const addSubject = async (semId: number) => {
    try {
      const res = await api.post(`/cgpa/semesters/${semId}/courses`, {
        name: 'New Subject',
        credits: 3,
        grade: 'A',
      })
      const created = res.data.course as Subject
      setSemesters(s => s.map(sem => sem.id === semId ? {
        ...sem,
        subjects: [...sem.subjects, created],
      } : sem))
    } catch {
      toast.error('Failed to add subject')
    }
  }

  const updateSubject = (semId: number, subId: number, field: keyof Omit<Subject, 'id'>, value: string | number) => {
    setSemesters(s => s.map(sem => sem.id === semId ? {
      ...sem,
      subjects: sem.subjects.map(sub => sub.id === subId ? { ...sub, [field]: value } : sub),
    } : sem))

    if (patchTimers.current[subId]) clearTimeout(patchTimers.current[subId])
    patchTimers.current[subId] = setTimeout(() => {
      void api.patch(`/cgpa/courses/${subId}`, { [field]: value }).catch(() => {
        toast.error('Failed to save course changes')
      })
    }, 450)
  }

  const removeSubject = async (semId: number, subId: number) => {
    try {
      await api.delete(`/cgpa/courses/${subId}`)
      setSemesters(s => s.map(sem => sem.id === semId ? {
        ...sem,
        subjects: sem.subjects.filter(sub => sub.id !== subId),
      } : sem))
    } catch {
      toast.error('Failed to remove subject')
    }
  }

  const requiredGPA = () => {
    const target = parseFloat(targetCGPA)
    const rem = parseInt(remainingSemesters)
    if (isNaN(target) || isNaN(rem) || rem === 0 || semesters.length === 0) return null
    const totalCreditsNow = semesters.flatMap(s => s.subjects).reduce((sum, s) => sum + s.credits, 0)
    if (totalCreditsNow === 0) return target
    const avgCreditsPerSem = totalCreditsNow / Math.max(semesters.length, 1)
    const totalPointsNow = semesters.flatMap(s => s.subjects).reduce((sum, s) => sum + (GRADE_POINTS[s.grade] || 0) * s.credits, 0)
    const totalPointsNeeded = target * (totalCreditsNow + avgCreditsPerSem * rem)
    const pointsNeeded = totalPointsNeeded - totalPointsNow
    const creditsNeeded = avgCreditsPerSem * rem
    return creditsNeeded > 0 ? pointsNeeded / creditsNeeded : null
  }

  const reqGPA = requiredGPA()

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#252525] tracking-tight">CGPA Calculator</h1>
        <p className="text-[#707070] text-sm mt-1">Calculate semester SGPA, cumulative CGPA, and targets</p>
      </div>

      {loadError && (
        <div className="p-4 rounded-xl bg-[#FBEFEF] border border-[#B45D5D]/30 text-xs text-[#B45D5D]">{loadError}</div>
      )}

      {/* CGPA Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 text-center bg-white border-[#E7E5E0]">
          <div className="text-[11px] text-[#707070] uppercase font-mono tracking-wider mb-1">Current CGPA</div>
          <div className="text-4xl font-bold font-mono text-[#5965B3] mb-0.5">{cgpa.toFixed(2)}</div>
          <div className="text-xs text-[#707070]">{semesters.length} semesters</div>
        </Card>
        {semesters.slice(-2).map(sem => (
          <Card key={sem.id} className="p-5 text-center bg-white border-[#E7E5E0]">
            <div className="text-[11px] text-[#707070] uppercase font-mono tracking-wider mb-1">{sem.name} SGPA</div>
            <div className="text-3xl font-bold font-mono text-[#252525] mb-0.5">{calcSGPA(sem.subjects).toFixed(2)}</div>
            <div className="text-xs text-[#707070]">{sem.subjects.length} subjects</div>
          </Card>
        ))}
      </div>

      {/* Predictor */}
      <Card className="p-5 bg-[#FAF9F6] border-[#E7E5E0]">
        <h3 className="font-semibold text-xs uppercase tracking-wider text-[#707070] flex items-center gap-2 mb-3"><Target className="w-4 h-4 text-[#5965B3]" /> Target CGPA Predictor</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <Input id="target-cgpa" label="Target CGPA" type="number" step="0.1" max="10" value={targetCGPA} onChange={e => setTargetCGPA(e.target.value)} />
          <Input id="rem-sems" label="Remaining semesters" type="number" value={remainingSemesters} onChange={e => setRemainingSemesters(e.target.value)} />
          <div className="p-3.5 rounded-lg bg-white border border-[#E7E5E0]">
            {reqGPA !== null ? (
              <>
                <div className="text-[11px] text-[#707070]">Required average SGPA</div>
                <div className={`text-2xl font-bold font-mono ${reqGPA <= 10 ? 'text-[#5C8A6A]' : 'text-[#B45D5D]'}`}>{reqGPA.toFixed(2)}</div>
                <div className="text-[11px] text-[#707070] mt-0.5">{reqGPA <= 10 ? 'Achievable target' : 'Unrealistic requirement'}</div>
              </>
            ) : <div className="text-xs text-[#999999]">Add semesters to calculate</div>}
          </div>
        </div>
      </Card>

      {/* Semester Tables */}
      {loading ? (
        <div className="text-center py-8 text-xs text-[#707070]">Loading semesters...</div>
      ) : semesters.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No semesters added yet"
          description="Add your first semester to calculate SGPA and cumulative CGPA."
          action={<Button onClick={() => void addSemester()} leftIcon={<Plus className="w-4 h-4" />}>Add Semester 1</Button>}
        />
      ) : (
        <div className="space-y-5">
          {semesters.map((sem) => (
            <motion.div key={sem.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-5 bg-white border-[#E7E5E0]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-semibold text-[#252525] text-sm">{sem.name}</h3>
                    <Badge variant="brand">SGPA: {calcSGPA(sem.subjects).toFixed(2)}</Badge>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => void addSubject(sem.id)} leftIcon={<Plus className="w-3.5 h-3.5" />}>Add subject</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#E7E5E0] bg-[#FAF9F6]">
                        <th className="text-left py-2 px-3 text-[#707070] font-medium">Subject</th>
                        <th className="text-center py-2 px-3 text-[#707070] font-medium w-24">Credits</th>
                        <th className="text-center py-2 px-3 text-[#707070] font-medium w-24">Grade</th>
                        <th className="text-center py-2 px-3 text-[#707070] font-medium w-20">Points</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E5E0]">
                      {sem.subjects.map(sub => (
                        <tr key={sub.id}>
                          <td className="py-2 px-3">
                            <input
                              value={sub.name}
                              onChange={e => updateSubject(sem.id, sub.id, 'name', e.target.value)}
                              className="bg-transparent text-[#252525] text-xs outline-none w-full font-medium"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              value={sub.credits}
                              min={1} max={10}
                              onChange={e => updateSubject(sem.id, sub.id, 'credits', parseInt(e.target.value) || 1)}
                              className="input py-1 text-xs w-full text-center"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={sub.grade}
                              onChange={e => updateSubject(sem.id, sub.id, 'grade', e.target.value)}
                              className="input py-1 text-xs w-full"
                            >
                              {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-[#5965B3] font-semibold font-mono">
                              {((GRADE_POINTS[sub.grade] || 0) * sub.credits).toFixed(0)}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <button onClick={() => void removeSubject(sem.id, sub.id)} className="text-[#999999] hover:text-[#B45D5D]">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 pt-3 border-t border-[#E7E5E0] flex justify-between text-[11px] text-[#707070] font-mono">
                  <span>Total Credits: {sem.subjects.reduce((s, sub) => s + sub.credits, 0)}</span>
                  <span>Total Points: {sem.subjects.reduce((s, sub) => s + (GRADE_POINTS[sub.grade] || 0) * sub.credits, 0)}</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {semesters.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => void addSemester()}>Add semester</Button>
        </div>
      )}
    </div>
  )
}
