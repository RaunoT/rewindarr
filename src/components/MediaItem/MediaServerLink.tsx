'use client'

import useIsIos from '@/hooks/useIsIos'
import { MediaServer } from '@/types/statsSource'
import { generateDeeplinkUrl } from '@/utils/deeplink'
import { getMediaServerName } from '@/utils/mediaServerName'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { ReactNode } from 'react'

type Props = {
  title: string
  ratingKey: number | string
  mediaServer: MediaServer
  // The poster's, which the title's link already says, so screen readers and
  // the keyboard skip it
  isDuplicate?: boolean
  className?: string
  children: ReactNode
}

// Opens the item in the media server, from its title and its poster. Inside
// a `media-link-group`, hovering either lights up both.
export default function MediaServerLink({
  title,
  ratingKey,
  mediaServer,
  isDuplicate,
  className,
  children,
}: Props) {
  const t = useTranslations('MediaServerDeeplink')
  const isIos = useIsIos()

  return (
    <a
      href={generateDeeplinkUrl(ratingKey, mediaServer, isIos)}
      target='_blank'
      rel='noopener noreferrer'
      data-media-link
      className={clsx('focus-visible:focus-ring rounded-md', className)}
      {...(isDuplicate
        ? { tabIndex: -1, 'aria-hidden': true }
        : {
            'aria-label': t('openLabel', {
              title,
              server: getMediaServerName(mediaServer.type),
            }),
          })}
    >
      {children}
    </a>
  )
}
