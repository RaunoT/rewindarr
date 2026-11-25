'use client'

import { toastQueue } from '@/components/Toasts'
import useFormChanges from '@/hooks/useFormChanges'
import { SettingsFormInitialState } from '@/types/settings'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  createContext,
  ReactNode,
  RefObject,
  useContext,
  useEffect,
  useRef,
} from 'react'
import LeaveGuard from './LeaveGuard'
import { useDiscard } from './SettingsDiscard'
import SettingsDiscardButton from './SettingsDiscardButton'
import SettingsSaveButton from './SettingsSaveButton'

const LoadedFieldsContext = createContext<(container: Element) => void>(
  () => {},
)

// For fields that are read after the form shows, inside the element the ref
// is on: called from the component that renders them once they're there, so
// they don't count as a change. Off for fields that only show because of an
// edit, which count as one. Only the first time they're there, as fields that
// go and come back can have been edited meanwhile.
export function useLoadedFields(
  ref: RefObject<Element | null>,
  isActive = true,
) {
  const markLoaded = useContext(LoadedFieldsContext)
  const isMarkedRef = useRef(false)

  useEffect(() => {
    if (isActive && ref.current && !isMarkedRef.current) {
      isMarkedRef.current = true
      markLoaded(ref.current)
    }
  }, [isActive, markLoaded, ref])
}

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
  const { isChanged, markSubmitted, markSaved, markLoaded } = useFormChanges(
    formRef,
    orderedFields,
  )
  // Without a save button there's nothing to save
  const hasUnsavedChanges = isChanged && !hideSubmit
  const discard = useDiscard()
  const takeIsDiscarded = discard?.takeIsDiscarded

  // After a discard the page starts over, which leaves nothing focused
  useEffect(() => {
    if (takeIsDiscarded?.()) {
      formRef.current
        ?.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.focus({ preventScroll: true })
    }
  }, [takeIsDiscarded])

  function handleDiscard() {
    // An error about the values being discarded no longer applies
    if (toastKey.current) {
      toastQueue.close(toastKey.current)
    }

    discard?.discard()
  }

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
        // Runs before the action, with the values it's sent
        onSubmit={markSubmitted}
        // React resets a form after its action, and React Aria then sets its
        // fields back to their first value: a multi-select to none and a
        // controlled switch to how it was on load. Fields that were saved
        // remount from their key, so only the others lost their value.
        // Cancelling the reset keeps every field as it was sent.
        onResetCapture={(event) => event.preventDefault()}
      >
        <div className='grid gap-4'>
          <LoadedFieldsContext value={markLoaded}>
            {children}
          </LoadedFieldsContext>
          {!hideSubmit && (
            // With unsaved changes it stays in sight at the bottom of the
            // screen, until it reaches its place at the end of the form
            <div
              className={clsx(
                'flex items-center justify-end gap-3',
                hasUnsavedChanges && 'save-bar min-w-0 max-sm:pl-2',
              )}
            >
              <output
                className={clsx(
                  'min-w-0 flex-1 text-sm text-neutral-200',
                  // On phones the two buttons fill the bar, as the label
                  // doesn't fit beside them in every language
                  hasUnsavedChanges ? 'max-sm:sr-only' : 'sr-only',
                )}
              >
                {hasUnsavedChanges && t('unsavedChanges')}
              </output>
              {hasUnsavedChanges && discard && (
                <SettingsDiscardButton
                  onPress={handleDiscard}
                  isDiscarding={discard.isDiscarding}
                />
              )}
              <SettingsSaveButton
                isSetup={isSetup}
                isCompact={hasUnsavedChanges}
                // A disabled save button also stops Enter from submitting
                isDisabled={discard?.isDiscarding}
              />
            </div>
          )}
        </div>
      </form>
      <LeaveGuard isActive={hasUnsavedChanges} />
    </>
  )
}
