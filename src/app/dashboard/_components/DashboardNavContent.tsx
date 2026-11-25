'use client'

import { GlobalContext } from '@/app/_components/GlobalContextProvider'
import TitleMenu from '@/components/TitleMenu'
import { getDashboardQuery, getLibrarySlug } from '@/utils/helpers'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useContext } from 'react'
import { DashboardNavProps } from './DashboardNav'

export default function DashboardNavContent({
  libraries,
  isUsersPageActive,
  filterAccess,
  isMenu,
}: DashboardNavProps) {
  const pathname = usePathname()
  const {
    dashboard: { isPersonal: personal, period, sortBy },
  } = useContext(GlobalContext)
  // The saved filters, like the sidebar's links. Another list starts from its
  // first rows.
  const filters = { personal, period, sortBy }
  const query = getDashboardQuery(filters, filterAccess)
  const usersQuery = getDashboardQuery(filters, filterAccess, true)
  const t = useTranslations('DashboardNavContent')

  if (isMenu) {
    return (
      <TitleMenu
        label={t('label')}
        items={[
          ...libraries.map((library) => ({
            href: `/dashboard/${getLibrarySlug(library)}${query}`,
            label: library.section_name,
            isCurrent: pathname === `/dashboard/${getLibrarySlug(library)}`,
          })),
          ...(isUsersPageActive
            ? [
                {
                  href: `/dashboard/users${usersQuery}`,
                  label: t('users'),
                  isCurrent: pathname === '/dashboard/users',
                },
              ]
            : []),
        ]}
      />
    )
  }

  return (
    <nav aria-label={t('label')}>
      <ul className='nav'>
        {libraries.map((library) => (
          <li key={library.section_id}>
            <Link
              href={`/dashboard/${getLibrarySlug(library)}${query}`}
              className='nav-link'
              aria-current={
                pathname === `/dashboard/${getLibrarySlug(library)}` && 'page'
              }
            >
              {library.section_name}
            </Link>
          </li>
        ))}
        {isUsersPageActive && (
          <li>
            <Link
              href={`/dashboard/users${usersQuery}`}
              className='nav-link'
              aria-current={pathname === '/dashboard/users' && 'page'}
            >
              {t('users')}
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}
