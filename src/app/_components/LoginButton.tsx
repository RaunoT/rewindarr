'use client'

import usePlexAuth from '@/hooks/usePlexAuth'
import { MediaServerType } from '@/types/settings'
import { useTranslations } from 'next-intl'
import { Button, Dialog, DialogTrigger, Popover } from 'react-aria-components'
import JellyfinLoginForm from './JellyfinLoginForm'
import LoginWithJellyfinLabel from './LoginWithJellyfinLabel'
import LoginWithPlexLabel from './LoginWithPlexLabel'

type Props = {
  siteUrl?: string
  mediaServerType: MediaServerType
}

export default function LoginButton({ siteUrl, mediaServerType }: Props) {
  const { isLoading, error, handleLogin } = usePlexAuth(siteUrl)
  const t = useTranslations('Home')

  if (mediaServerType === 'jellyfin') {
    return (
      <DialogTrigger>
        <Button className='button button--jellyfin button-sm'>
          <LoginWithJellyfinLabel />
        </Button>
        {/* Below the button, so the header keeps its layout */}
        <Popover
          placement='bottom end'
          offset={8}
          className='glass-sheet w-72 bg-neutral-900/80'
        >
          <Dialog className='outline-none'>
            <JellyfinLoginForm />
          </Dialog>
        </Popover>
      </DialogTrigger>
    )
  }

  return (
    <div className='relative'>
      <button
        className='button button--plex button-sm'
        onClick={handleLogin}
        disabled={isLoading}
      >
        <LoginWithPlexLabel />
      </button>
      {/* Below the button, so the header keeps its layout */}
      {error && (
        <p
          role='alert'
          className='glass-sheet text-danger absolute top-full right-0 z-10 mt-2 w-64 rounded-2xl bg-neutral-900/80 p-3 text-sm'
        >
          {t(`loginError.${error}`)}
        </p>
      )}
    </div>
  )
}
