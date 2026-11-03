'use client'

import Loader from '@/components/Loader'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useFormStatus } from 'react-dom'

type Props = {
  isSetup?: boolean
}

export default function SettingsSaveButton({ isSetup }: Props) {
  const { pending } = useFormStatus()
  const t = useTranslations('Settings')

  return (
    <button
      className='button relative flex w-full min-w-28 justify-center sm:w-fit'
      type='submit'
      disabled={pending}
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
