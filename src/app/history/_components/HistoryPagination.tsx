import { getPageNumbers } from '@/utils/getHistory'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { ReactNode, Suspense } from 'react'
import PageSizeSelect from './PageSizeSelect'

type Props = {
  page: number
  pageCount: number
  pageSize: number
  // The page's URL, with the filters kept
  getHref: (page: number) => string
}

const PAGE_LINK =
  'focus-visible:focus-ring inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm tabular-nums transition-colors'
const PAGE_LINK_IDLE = 'text-neutral-300 hover:bg-white/10 hover:text-white'

// The pages in the middle and the rows per page at the end, like under a
// table. On phones the page numbers don't fit next to the rows per page, so
// only the arrows and where you are go at the start.
export default function HistoryPagination({
  page,
  pageCount,
  pageSize,
  getHref,
}: Props) {
  const t = useTranslations('History')

  return (
    <div className='mt-3 flex items-center justify-between gap-4 border-t border-white/10 pt-3'>
      {/* Keeps the pages in the middle */}
      <div className='max-sm:hidden sm:flex-1' />
      {pageCount > 1 && (
        <nav
          aria-label={t('pagination')}
          className='flex items-center justify-center gap-1'
        >
          <ArrowLink
            href={page > 1 ? getHref(page - 1) : null}
            label={t('previousPage')}
          >
            <ChevronLeftIcon className='size-4' />
          </ArrowLink>
          <PageList
            numbers={getPageNumbers(page, pageCount)}
            page={page}
            getHref={getHref}
            className='max-sm:hidden'
          />
          <span className='px-2 text-sm text-neutral-300 tabular-nums sm:hidden'>
            {t('pageOf', { page, pageCount })}
          </span>
          <ArrowLink
            href={page < pageCount ? getHref(page + 1) : null}
            label={t('nextPage')}
          >
            <ChevronRightIcon className='size-4' />
          </ArrowLink>
        </nav>
      )}
      <div className='ml-auto flex justify-end sm:flex-1'>
        <Suspense>
          <PageSizeSelect value={pageSize} />
        </Suspense>
      </div>
    </div>
  )
}

type PageListProps = {
  // Null where pages are left out
  numbers: (number | null)[]
  page: number
  getHref: (page: number) => string
  className: string
}

function PageList({ numbers, page, getHref, className }: PageListProps) {
  const t = useTranslations('History')

  return (
    <ul className={clsx('flex items-center gap-1', className)}>
      {numbers.map((number, i) => (
        <li key={number ?? `gap-${i}`}>
          {number === null ? (
            <span className='px-1 text-sm text-neutral-500'>{'…'}</span>
          ) : (
            <Link
              href={getHref(number)}
              className={clsx(
                PAGE_LINK,
                number === page
                  ? 'bg-white/15 font-medium text-white'
                  : PAGE_LINK_IDLE,
              )}
              aria-current={number === page ? 'page' : undefined}
              aria-label={t('page', { page: number })}
            >
              {number}
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}

type ArrowLinkProps = {
  // Null on the first or the last page
  href: string | null
  label: string
  children: ReactNode
}

function ArrowLink({ href, label, children }: ArrowLinkProps) {
  if (!href) {
    return (
      <span className={clsx(PAGE_LINK, 'text-neutral-600')} aria-hidden='true'>
        {children}
      </span>
    )
  }

  return (
    <Link
      href={href}
      className={clsx(PAGE_LINK, PAGE_LINK_IDLE)}
      aria-label={label}
    >
      {children}
    </Link>
  )
}
