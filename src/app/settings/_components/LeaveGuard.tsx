'use client'

import { getLeavingPath, setLeaveGuard } from '@/utils/unsavedChanges'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Dialog,
  Heading,
  Modal,
  ModalOverlay,
  Text,
} from 'react-aria-components'

type Props = {
  isActive: boolean
}

// Asks before leaving a page with unsaved changes. The browser asks itself on
// a reload, on closing the tab and on leaving the app. App Router has no way
// to hold a navigation, so clicks on links in the app are caught before Next
// sees them, and menus that navigate ask through guardLeave.
export default function LeaveGuard({ isActive }: Props) {
  const t = useTranslations('Settings')
  const router = useRouter()
  const [pendingLeave, setPendingLeave] = useState<(() => unknown) | null>(null)
  // Once leaving is confirmed, a reload it causes doesn't ask again
  const isLeavingRef = useRef(false)

  // A save that finishes while it asks leaves nothing to lose
  if (!isActive && pendingLeave) {
    setPendingLeave(null)
  }

  useEffect(() => {
    if (!isActive) {
      return
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (isLeavingRef.current) {
        return
      }

      event.preventDefault()
      // Safari only asks with this set
      event.returnValue = ''
    }

    function handleClick(event: MouseEvent) {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href]')
          : null

      if (!link || event.defaultPrevented) {
        return
      }

      const path = getLeavingPath(
        {
          href: link.href,
          target: link.target,
          isDownload: link.hasAttribute('download'),
          isDisabled: link.getAttribute('aria-disabled') === 'true',
          button: event.button,
          hasModifier:
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
        },
        new URL(window.location.href),
      )

      if (!path) {
        return
      }

      // Captured on the document, before the link's own handler navigates
      event.preventDefault()
      event.stopPropagation()
      setPendingLeave(() => () => router.push(path))
    }

    setLeaveGuard((leave) => setPendingLeave(() => leave))
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleClick, true)

    return () => {
      setLeaveGuard(null)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleClick, true)
    }
  }, [isActive, router])

  async function leave() {
    const proceed = pendingLeave

    isLeavingRef.current = true
    setPendingLeave(null)

    try {
      await proceed?.()
    } finally {
      // Still here, so leaving didn't happen, or happened within the app
      isLeavingRef.current = false
    }
  }

  return (
    <ModalOverlay
      isOpen={!!pendingLeave}
      onOpenChange={(isOpen) => !isOpen && setPendingLeave(null)}
      isDismissable
      className='sheet-overlay sm:items-center sm:justify-center sm:p-4'
    >
      <Modal className='glass-sheet sheet sheet--dialog'>
        <Dialog role='alertdialog' className='flex flex-col gap-6 outline-none'>
          <div className='grid gap-2'>
            <Heading slot='title' className='text-lg font-semibold'>
              {t('leaveTitle')}
            </Heading>
            <Text
              slot='description'
              elementType='p'
              className='text-sm text-neutral-300'
            >
              {t('leaveDescription')}
            </Text>
          </div>
          <div className='flex gap-3'>
            <Button
              className='data-focus-visible:focus-ring flex-1 rounded-full px-6 py-2.5 font-semibold ring-1 ring-white/20 transition-colors ring-inset hover:bg-white/10'
              onPress={() => setPendingLeave(null)}
              // Staying is the safe answer, so Enter gives it
              // oxlint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            >
              {t('stay')}
            </Button>
            <Button className='button flex-1' onPress={leave}>
              {t('leave')}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
