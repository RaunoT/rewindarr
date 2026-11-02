import { PublicSettings } from '@/types/settings'
import { Suspense } from 'react'
import DashboardFilters from './DashboardFilters'

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
      <DashboardFilters
        settings={settings}
        personalFilter={personalFilter}
        isUsers={isUsers}
      />
    </Suspense>
  )
}
