'use client'

import { toastQueue } from '@/components/Toasts'
import useFormChanges from '@/hooks/useFormChanges'
import { SettingsFormInitialState } from '@/types/settings'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ReactNode, useEffect, useRef } from 'react'
import LeaveGuard from './LeaveGuard'
import SettingsSaveButton from './SettingsSaveButton'

type Props = {
  children: ReactNode
  formState: SettingsFormInitialState<unknown>
  formAction: (payload: FormData) => void
  hideSubmit?: boolean
  isSetup?: boolean
  // Fields whose values are saved in the order they're sent
  orderedFields?: string[]
}

export default function SettingsForm({
  children,
  formState,
  formAction,
  hideSubmit,
  isSetup,
  orderedFields,
}: Props) {
  const router = useRouter()
  const t = useTranslations('Settings')
  const toastKey = useRef<string>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const { isChanged, markSaved } = useFormChanges(formRef, orderedFields)
  // Without a save button there's nothing to save
  const hasUnsavedChanges = isChanged && !hideSubmit

  // Each save returns a new state, so this runs once per save. A new result
  // replaces the last one rather than stacking up.
  useEffect(() => {
    if (formState.status === 'success') {
      markSaved()
    }

    if (formState.status === 'success' && formState.nextPage) {
      router.push(formState.nextPage)
    }

    if (!formState.message) {
      return
    }

    if (toastKey.current) {
      toastQueue.close(toastKey.current)
    }

    const isSuccess = formState.status === 'success'

    toastKey.current = toastQueue.add(
      { message: formState.message, status: isSuccess ? 'success' : 'error' },
      // Errors stay until dismissed, so they can be read
      isSuccess ? { timeout: 5000 } : undefined,
    )
  }, [formState, router, markSaved])

  return (
    <>
      <form
        ref={formRef}
        className='glass-sheet'
        action={formAction}
        // React resets a form after its action, and React Aria then sets its
        // fields back to their first value: a multi-select to none and a
        // controlled switch to how it was on load. Fields that were saved
        // remount from their key, so only the others lost their value.
        // Cancelling the reset keeps every field as it was sent.
        onResetCapture={(event) => event.preventDefault()}
      >
        <div className='grid gap-4'>
          {children}
          {!hideSubmit && (
            // With unsaved changes it stays in sight at the bottom of the
            // screen, until it reaches its place at the end of the form
            <div
              className={clsx(
                'flex items-center justify-end gap-3',
                hasUnsavedChanges && 'save-bar',
              )}
            >
              <output
                className={clsx(
                  'min-w-0 flex-1 text-sm text-neutral-200',
                  !hasUnsavedChanges && 'sr-only',
                )}
              >
                {hasUnsavedChanges && t('unsavedChanges')}
              </output>
              <SettingsSaveButton
                isSetup={isSetup}
                isCompact={hasUnsavedChanges}
              />
            </div>
          )}
        </div>
      </form>
      <LeaveGuard isActive={hasUnsavedChanges} />
    </>
  )
}
