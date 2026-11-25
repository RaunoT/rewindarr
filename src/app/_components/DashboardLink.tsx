'use client'

import { DashboardSearchParams } from '@/types/dashboard'
import { DashboardFilterAccess, getDashboardQuery } from '@/utils/helpers'
import Link from 'next/link'
import { ReactNode, useContext } from 'react'
import { GlobalContext } from './GlobalContextProvider'

type Props = {
  // The library's dashboard, without filters
  href: string
  // From its cookie, until the saved one has been read
  period: DashboardSearchParams['period']
  filterAccess: DashboardFilterAccess
  className?: string
  children: ReactNode
}

// Opens the dashboard with the filters saved from the last visit, like the
// sidebar's links
export default function DashboardLink({
  href,
  period: cookiePeriod,
  filterAccess,
  className,
  children,
}: Props) {
  const {
    dashboard: { isPersonal: personal, period: savedPeriod, sortBy, isLoaded },
  } = useContext(GlobalContext)
  // The same as the server's HTML until then, like the sidebar's after
  const period = isLoaded ? savedPeriod : cookiePeriod
  const query = getDashboardQuery({ personal, period, sortBy }, filterAccess)

  return (
    <Link href={`${href}${query}`} className={className}>
      {children}
    </Link>
  )
}
