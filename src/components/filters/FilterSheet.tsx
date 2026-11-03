'use client'

import useMediaQuery from '@/hooks/useMediaQuery'
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { ReactNode } from 'react'
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Popover,
} from 'react-aria-components'

type SheetProps = {
  // How many of the filters in it are on
  count: number
  // Whether anything differs from the defaults, the period too
  canClear: boolean
  onClear: () => void
  // Filter groups
  children: ReactNode
  className?: string
}

// From Tailwind's sm breakpoint up
const WIDE_QUERY = '(min-width: 40rem)'

// The filters beyond the period and the search, behind one button that counts
// those that are on. A panel under it on wider screens, a sheet from the
// bottom on phones. Filters apply as they're picked, so the list behind
// updates while it's open. When they don't fit, they scroll and the buttons
// stay in sight.
export default function FilterSheet({
  count,
  canClear,
  onClear,
  children,
  className,
}: SheetProps) {
  const t = useTranslations('Filters')
  const isWide = useMediaQuery(WIDE_QUERY)
  const content = (
    <Dialog className='flex min-h-0 flex-1 flex-col gap-6 outline-none'>
      {({ close }) => (
        <>
          {/* Out to the edges, so the scrollbar sits there */}
          <div className='thin-scrollbar -mx-5 flex min-h-0 flex-col gap-6 overflow-y-auto px-5'>
            <Heading slot='title' className='text-lg font-semibold'>
              {t('title')}
            </Heading>
            {children}
          </div>
          <div className='flex shrink-0 gap-3'>
            <Button
              className='data-focus-visible:focus-ring flex-1 rounded-full px-6 py-2.5 font-semibold ring-1 ring-white/20 transition-colors ring-inset hover:bg-white/10 disabled:opacity-40'
              isDisabled={!canClear}
              onPress={onClear}
            >
              {t('clearAll')}
            </Button>
            <Button className='button flex-1' onPress={close}>
              {t('done')}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )

  return (
    <DialogTrigger>
      <Button
        className={clsx('filter-button filter-button--toggle', className)}
        aria-label={count ? t('titleWithCount', { count }) : t('title')}
        data-active={count > 0 || undefined}
      >
        <AdjustmentsHorizontalIcon />
        <span className='max-sm:sr-only'>{t('title')}</span>
        {count > 0 && (
          <span className='filter-badge' aria-hidden='true'>
            {count}
          </span>
        )}
      </Button>
      {isWide ? (
        <Popover
          placement='bottom end'
          offset={8}
          className='glass-sheet filter-panel'
        >
          {content}
        </Popover>
      ) : (
        <ModalOverlay isDismissable className='sheet-overlay'>
          <Modal className='glass-sheet sheet'>{content}</Modal>
        </ModalOverlay>
      )}
    </DialogTrigger>
  )
}

// A filter in the sheet, under a heading of its own
export function FilterGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <section className='flex flex-col gap-2'>
      <h3 className='text-xs font-semibold text-neutral-400'>{label}</h3>
      {children}
    </section>
  )
}
