import { Library } from '@/types/statsSource'
import { DashboardFilterAccess } from '@/utils/helpers'
import { Suspense } from 'react'
import DashboardNavContent from './DashboardNavContent'

export type DashboardNavProps = {
  libraries: Library[]
  isUsersPageActive: boolean
  filterAccess: DashboardFilterAccess
  isMenu?: boolean
}

export default function DashboardNav(props: DashboardNavProps) {
  return (
    <Suspense>
      <DashboardNavContent {...props} />
    </Suspense>
  )
}
