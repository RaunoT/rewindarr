'use client'

import { STAT_ICONS } from '@/components/icons'
import useIsIos from '@/hooks/useIsIos'
import { Deeplink, generateDeeplinkUrl } from '@/utils/deeplink'
import { getMediaServerName } from '@/utils/mediaServerName'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { ReactNode } from 'react'

type Props = {
  title: string
  link: Deeplink
  className?: string
  children: ReactNode
}

// Opens the item in the media server, or in Seerr to request it, from its
// poster. Hovering or focusing it shows the poster's MediaLinkIcon.
export default function MediaLink({ title, link, className, children }: Props) {
  const t = useTranslations()
  const isIos = useIsIos()
  const { href, label } =
    'requestUrl' in link
      ? {
          href: link.requestUrl,
          label: t('MediaItem.requestLabel', { title }),
        }
      : {
          href: generateDeeplinkUrl(link.ratingKey, link.mediaServer, isIos),
          label: t('MediaServerDeeplink.openLabel', {
            title,
            server: getMediaServerName(link.mediaServer.type),
          }),
        }

  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      data-media-link
      aria-label={label}
      className={clsx('focus-visible:focus-ring rounded-md', className)}
    >
      {children}
    </a>
  )
}

// Inside the poster, which sets its size and shape. While the poster is
// hovered, it says where it goes: out to the media server, or to a request.
export function MediaLinkIcon({ link }: { link: Deeplink }) {
  const Icon =
    'requestUrl' in link ? STAT_ICONS.requests : ArrowTopRightOnSquareIcon

  return (
    <span aria-hidden='true' className='poster-overlay media-link-icon'>
      <Icon className='size-7 drop-shadow' />
    </span>
  )
}
