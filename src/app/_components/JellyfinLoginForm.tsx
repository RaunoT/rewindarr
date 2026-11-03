'use client'

import { LoginErrorCode } from '@/lib/loginError'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { FormEvent, useState } from 'react'
import JellyfinQuickConnect from './JellyfinQuickConnect'
import LoginWithJellyfinLabel from './LoginWithJellyfinLabel'
import signInWithJellyfin from './signInWithJellyfin'

type Props = {
  className?: string
}

export default function JellyfinLoginForm({ className }: Props) {
  const t = useTranslations('Home')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<LoginErrorCode | null>(null)
  const [isQuickConnect, setIsQuickConnect] = useState<boolean>(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    setIsLoading(true)
    setError(null)
    setError(
      await signInWithJellyfin('jellyfin', {
        username: formData.get('username'),
        password: formData.get('password'),
      }),
    )
    setIsLoading(false)
  }

  if (isQuickConnect) {
    return (
      <div className={clsx('w-full', className)}>
        <JellyfinQuickConnect onCancel={() => setIsQuickConnect(false)} />
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={clsx('flex w-full flex-col gap-3 text-left', className)}
    >
      <label className='flex flex-col gap-1.5 text-sm'>
        {t('username')}
        <input
          className='input'
          name='username'
          autoComplete='username'
          autoCapitalize='none'
          spellCheck={false}
          required
        />
      </label>
      <label className='flex flex-col gap-1.5 text-sm'>
        {t('password')}
        <input
          className='input'
          name='password'
          type='password'
          autoComplete='current-password'
        />
      </label>
      <button
        type='submit'
        className='button button--jellyfin mt-1 w-full'
        disabled={isLoading}
      >
        <LoginWithJellyfinLabel />
      </button>
      {error && (
        <p role='alert' className='text-danger text-center text-sm'>
          {t(`loginError.${error}`)}
        </p>
      )}
      <button
        type='button'
        className='link mx-auto w-fit text-sm'
        onClick={() => setIsQuickConnect(true)}
        disabled={isLoading}
      >
        {t('useQuickConnect')}
      </button>
    </form>
  )
}
