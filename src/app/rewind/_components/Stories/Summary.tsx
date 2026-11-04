import Avatar from '@/components/Avatar'
import PosterImage from '@/components/PosterImage'
import { RewindStory } from '@/types/rewind'
import { trackEvent } from '@/utils/analytics'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ShareIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import RewindStat from '../RewindStat'
import {
  canShareImages,
  downloadImage,
  renderImage,
  toImageFile,
} from '../saveImage'
import SummaryImage from '../SummaryImage'
import useRewindSummary, { SummaryStat } from '../useRewindSummary'

type Status = 'idle' | 'saving' | 'sharing' | 'failed'

// After the story's own animations, which drawing the image would slow down
const PREPARE_DELAY = 800

function subscribeToNothing() {
  return () => {}
}

// Unknown before hydration, so the share button only shows once it's known
function getServerCanShare() {
  return false
}

export default function StorySummary({ userRewind, settings }: RewindStory) {
  const t = useTranslations('Rewind.Summary')
  const summary = useRewindSummary(userRewind, settings)
  const imageNodeRef = useRef<HTMLDivElement>(null)
  // Kept once drawn, so saving and then sharing draws it once
  const imageRef = useRef<Promise<Blob> | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  // Browsers only open the share sheet for a moment after the press, which
  // drawing the image can outlast, so it's drawn beforehand
  const [sharedImage, setSharedImage] = useState<Blob | 'failed' | null>(null)
  const canShare = useSyncExternalStore(
    subscribeToNothing,
    canShareImages,
    getServerCanShare,
  )
  const isBusy = status === 'saving' || status === 'sharing'
  const { tops, personality } = summary
  const [total, ...highlights] = summary.stats
  const getImage = useCallback(() => {
    if (!imageNodeRef.current) {
      return Promise.reject(new Error('The image is not shown'))
    }

    if (!imageRef.current) {
      const image = renderImage(imageNodeRef.current)

      imageRef.current = image
      // A failed one is drawn again on the next press
      image.catch(() => {
        if (imageRef.current === image) {
          imageRef.current = null
        }
      })
    }

    return imageRef.current
  }, [])

  useEffect(() => {
    if (!canShare) {
      return
    }

    let isActive = true

    const timer = setTimeout(() => {
      getImage().then(
        (image) => isActive && setSharedImage(image),
        () => isActive && setSharedImage('failed'),
      )
    }, PREPARE_DELAY)

    return () => {
      isActive = false
      clearTimeout(timer)
    }
  }, [canShare, getImage])

  async function save() {
    if (isBusy) {
      return
    }

    setStatus('saving')

    try {
      downloadImage(await getImage(), summary.fileName)
      setStatus('idle')
      trackEvent('rewind_summary_image', { action: 'save' })
    } catch (error) {
      console.error('[REWIND] - Unable to save the summary image!', error)
      setStatus('failed')
    }
  }

  async function share() {
    if (isBusy || !sharedImage) {
      return
    }

    setStatus('sharing')

    try {
      // Drawn again only when drawing it beforehand failed
      const image = sharedImage === 'failed' ? await getImage() : sharedImage

      await navigator.share({
        files: [toImageFile(image, summary.fileName)],
        title: summary.title,
      })
      setStatus('idle')
      trackEvent('rewind_summary_image', { action: 'share' })
    } catch (error) {
      // Closing the share sheet isn't a failure
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus('idle')

        return
      }

      console.error('[REWIND] - Unable to share the summary image!', error)
      setStatus('failed')
    }
  }

  return (
    <RewindStat noScale>
      <div className='text-base leading-normal font-normal tracking-normal sm:grid sm:grid-cols-2 sm:gap-8'>
        <div>
          <div className='flex items-center gap-4'>
            <div className='relative size-12 shrink-0 overflow-hidden rounded-full ring-2 ring-white/15 sm:size-16'>
              <Avatar src={summary.image} name={summary.name} sizes='4rem' />
            </div>
            <div className='min-w-0'>
              <p className='text-plex truncate text-xs font-semibold tracking-[0.2em] uppercase'>
                {summary.title}
              </p>
              <p className='truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl'>
                {summary.name}
              </p>
              <p className='text-sm text-neutral-400'>{summary.period}</p>
            </div>
          </div>

          {tops.length > 0 && (
            <ul className='mt-4 grid max-w-60 grid-cols-3 gap-3 sm:mt-6 sm:max-w-none'>
              {tops.map(({ type, label, item, srcs }) => (
                <li key={type} className='min-w-0'>
                  <div className='poster w-full sm:w-full'>
                    <PosterImage
                      srcs={srcs}
                      type={type}
                      sizes='(min-width: 640px) 10rem, 6rem'
                    />
                  </div>
                  <p className='text-plex mt-2 text-[0.625rem] font-semibold tracking-[0.14em] uppercase sm:text-xs'>
                    {label}
                  </p>
                  <p className='truncate text-sm leading-snug font-medium text-neutral-100 sm:line-clamp-2 sm:[overflow-wrap:anywhere] sm:whitespace-normal'>
                    {item.title}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className='mt-4 sm:mt-0'>
          <div className='grid grid-cols-2 gap-2 sm:gap-3'>
            <StatTile stat={total} isWide />
            {highlights.map((stat, index) => (
              <StatTile
                key={stat.key}
                stat={stat}
                // An odd one out at the end fills its row
                isWide={index === highlights.length - 1 && index % 2 === 0}
              />
            ))}
            {personality && (
              <div className='col-span-2 flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 ring-inset'>
                <span className='bg-plex/15 text-plex ring-plex/30 flex size-9 shrink-0 items-center justify-center rounded-full ring-1 sm:size-10'>
                  <personality.Icon className='size-5' />
                </span>
                <dl className='min-w-0'>
                  <dt className='text-[0.6875rem] leading-tight font-semibold tracking-[0.12em] text-neutral-400 uppercase'>
                    {personality.label}
                  </dt>
                  <dd className='text-plex text-lg leading-tight font-semibold sm:text-xl'>
                    {personality.name}
                  </dd>
                </dl>
              </div>
            )}
          </div>

          {/* Not disabled while busy, which would drop the focus, so the arrow
              keys would step the story. Smaller on phones, so both fit on a
              row in every language. */}
          <div className='mt-4 flex gap-2 sm:mt-6 sm:gap-3'>
            <button
              type='button'
              className='button aria-disabled:cursor-wait max-sm:px-4 max-sm:text-sm'
              onClick={save}
              aria-disabled={isBusy}
            >
              {status === 'saving' ? (
                <ArrowPathIcon className='size-5 motion-safe:animate-spin' />
              ) : (
                <ArrowDownTrayIcon className='size-5' />
              )}
              {t('save')}
            </button>
            {canShare && (
              <button
                type='button'
                className='button button--glass aria-disabled:cursor-wait max-sm:px-4 max-sm:text-sm'
                onClick={share}
                aria-disabled={isBusy || !sharedImage}
              >
                {status === 'sharing' || !sharedImage ? (
                  <ArrowPathIcon className='size-5 motion-safe:animate-spin' />
                ) : (
                  <ShareIcon className='size-5' />
                )}
                {t('share')}
              </button>
            )}
          </div>

          {/* Always there, so screen readers hear what's added to it */}
          <p role='status' className='text-danger text-sm'>
            {status === 'failed' && (
              <span className='mt-2 block'>{t('failed')}</span>
            )}
            {status === 'saving' && (
              <span className='sr-only'>{t('saving')}</span>
            )}
          </p>
        </div>
      </div>

      {/* The saved image, drawn from the same summary. It stays out of sight
          and out of reach, and only the export sees it. */}
      <div className='h-0 w-0 overflow-hidden' aria-hidden inert>
        <SummaryImage ref={imageNodeRef} summary={summary} />
      </div>
    </RewindStat>
  )
}

type StatTileProps = {
  stat: SummaryStat
  isWide?: boolean
}

function StatTile({ stat, isWide }: StatTileProps) {
  return (
    <dl
      className={clsx(
        'min-w-0 rounded-2xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 ring-inset',
        isWide && 'col-span-2',
      )}
    >
      <dt className='text-[0.6875rem] leading-tight font-semibold tracking-[0.12em] text-neutral-400 uppercase'>
        {stat.label}
      </dt>
      <dd className='truncate text-lg leading-tight font-semibold text-white sm:text-xl'>
        {stat.value}
      </dd>
      {stat.detail && (
        <dd className='truncate text-sm text-neutral-400'>{stat.detail}</dd>
      )}
    </dl>
  )
}
