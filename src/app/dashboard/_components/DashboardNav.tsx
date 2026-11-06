import { Library } from '@/types/statsSource'
import { Suspense } from 'react'
import DashboardNavContent from './DashboardNavContent'

export type DashboardNavProps = {
  libraries: Library[]
  isUsersPageActive: boolean
  isMenu?: boolean
}

export default function DashboardNav(props: DashboardNavProps) {
  return (
    <Suspense>
      <DashboardNavContent {...props} />
    </Suspense>
  )
}
