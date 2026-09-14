import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '@/features/auth'
import { Button } from '@/shared/ui/button'

import { useStudentProgress } from '../api/studentProgress'
import { AchievementHistoryList } from './AchievementHistoryList'
import { SkillAssessmentPanel } from './SkillAssessmentPanel'

/** Coach entry point "from a student" — reachable from a session roster row
 * or (once StudentDetailPage links here) a skater's own profile. */
export function CoachStudentSkillsPage() {
  const { studentId = '' } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: progress } = useStudentProgress(studentId)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => {
            void navigate(-1)
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-extrabold tracking-tight">
          {progress?.fullName ?? 'Skills'}
        </h1>
      </div>

      {profile?.academy_id && (
        <SkillAssessmentPanel
          studentId={studentId}
          academyId={profile.academy_id}
          onPromoted={() => {
            void navigate(-1)
          }}
        />
      )}

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          History
        </h2>
        <AchievementHistoryList studentId={studentId} />
      </div>
    </div>
  )
}
