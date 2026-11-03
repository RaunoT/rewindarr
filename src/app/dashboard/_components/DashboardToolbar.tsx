import { PublicSettings } from '@/types/settings'
import { Suspense } from 'react'
import DashboardFilters from './DashboardFilters'
import PeriodFilter from './PeriodFilter'

type Props = {
  settings: PublicSettings
  personalFilter?: boolean
  isUsers?: boolean
}

// Rendered by both the dashboard and its loader, so the filters stay on
// screen while a new period or filter loads
export default function DashboardToolbar({
  settings,
  personalFilter = false,
  isUsers = false,
}: Props) {
  return (
    // As tall as the filters, so nothing moves once they render
    <Suspense fallback={<div className='mb-4 h-10' />}>
      {isUsers ? (
        // The users dashboard has only the period. The other filters aren't
        // mounted, so their saved values are left alone.
        <div className='mb-4 flex items-center gap-2'>
          <PeriodFilter settings={settings} className='max-sm:flex-1' />
        </div>
      ) : (
        <DashboardFilters settings={settings} personalFilter={personalFilter} />
      )}
    </Suspense>
  )
}
