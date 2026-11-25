'use client'

import Loader from '@/components/Loader'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useFormStatus } from 'react-dom'

type Props = {
  isSetup?: boolean
  // In the save bar, beside Discard, rather than on its own row
  isCompact?: boolean
  isDisabled?: boolean
}

export default function SettingsSaveButton({
  isSetup,
  isCompact,
  isDisabled,
}: Props) {
  const { pending } = useFormStatus()
  const t = useTranslations('Settings')

  return (
    <button
      className={clsx(
        'button relative flex min-w-28 shrink-0 justify-center',
        isCompact ? 'w-fit max-sm:flex-1 max-sm:px-4' : 'w-full sm:w-fit',
      )}
      type='submit'
      disabled={pending || isDisabled}
    >
      {/* Kept while saving, so the button doesn't change width */}
      <span className={clsx(pending && 'invisible')}>
        {t(isSetup ? 'continue' : 'save')}
      </span>
      {pending && (
        <span className='absolute inset-0 flex items-center justify-center'>
          <Loader size={6} />
        </span>
      )}
    </button>
  )
}
