'use client'

import { toastQueue } from '@/components/Toasts'
import { SettingsFormInitialState } from '@/types/settings'
import { useRouter } from 'next/navigation'
import { ReactNode, useEffect, useRef } from 'react'
import SettingsSaveButton from './SettingsSaveButton'

type Props = {
  children: ReactNode
  formState: SettingsFormInitialState<unknown>
  formAction: (payload: FormData) => void
  hideSubmit?: boolean
  isSetup?: boolean
}

export default function SettingsForm({
  children,
  formState,
  formAction,
  hideSubmit,
  isSetup,
}: Props) {
  const router = useRouter()
  const toastKey = useRef<string>(null)

  // Each save returns a new state, so this runs once per save. A new result
  // replaces the last one rather than stacking up.
  useEffect(() => {
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
  }, [formState, router])

  return (
    <form
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
          <div className='flex justify-end'>
            <SettingsSaveButton isSetup={isSetup} />
          </div>
        )}
      </div>
    </form>
  )
}
