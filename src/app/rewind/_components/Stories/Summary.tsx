import Avatar from '@/components/Avatar'
import MediaServerLink from '@/components/MediaItem/MediaServerLink'
import PosterImage from '@/components/PosterImage'
import { RewindStory } from '@/types/rewind'
import { trackEvent } from '@/utils/analytics'
import { getRowDeeplink } from '@/utils/deeplink'
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
  savesWithShareSheet,
  toImageFile,
} from '../saveImage'
import SummaryImage from '../SummaryImage'
import SummaryStatList from '../SummaryStatList'
import useRewindSummary from '../useRewindSummary'

type Action = 'save' | 'share'
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

function getCanSaveWithShare() {
  return canShareImages() && savesWithShareSheet()
}

export default function StorySummary({ userRewind, settings }: RewindStory) {
  const t = useTranslations('Rewind.Summary')
  const summary = useRewindSummary(userRewind, settings)
  const imageNodeRef = useRef<HTMLDivElement>(null)
  // Kept once drawn, so saving and then sharing draws it once
  const imageRef = useRef<Promise<Blob> | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  // Browsers only open the share sheet for a moment after the press, which
  // drawing the image can outlast, so it's drawn beforehand. The buttons don't
  // wait for it, as most presses come after it's done.
  const [sharedImage, setSharedImage] = useState<Blob | 'failed' | null>(null)
  // So a press that waited for the image doesn't open the share sheet over
  // the story the viewer moved on to
  const isMountedRef = useRef(true)
  const canShare = useSyncExternalStore(
    subscribeToNothing,
    canShareImages,
    getServerCanShare,
  )
  // On iPhones and iPads saving goes through the share sheet too, as a
  // download wouldn't reach Photos
  const canSaveWithShare = useSyncExternalStore(
    subscribeToNothing,
    getCanSaveWithShare,
    getServerCanShare,
  )
  const isBusy = status === 'saving' || status === 'sharing'
  const { tops, personality } = summary
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
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
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
    if (canSaveWithShare) {
      return share('save')
    }

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

  async function share(action: Action) {
    if (isBusy) {
      return
    }

    setStatus(action === 'save' ? 'saving' : 'sharing')

    try {
      let image = sharedImage

      // Waited for when it isn't drawn yet, and drawn again when drawing it
      // beforehand failed, then kept for the next press. Drawing can outlast
      // the moment after this press in which the share sheet may open, and
      // then that press asks to try again.
      if (!(image instanceof Blob)) {
        image = await getImage()

        if (!isMountedRef.current) {
          return
        }

        setSharedImage(image)
      }

      await navigator.share({
        files: [toImageFile(image, summary.fileName)],
        title: summary.title,
      })
      setStatus('idle')
      trackEvent('rewind_summary_image', { action })
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
      <div className='text-base leading-normal font-normal tracking-normal'>
        <div className='flex items-center gap-4'>
          {/* As tall as the lines beside it */}
          <div
            className={clsx(
              'relative shrink-0 overflow-hidden rounded-full border-2 border-white/15',
              personality ? 'size-18.5 sm:size-20.5' : 'size-12.5 sm:size-14.5',
            )}
          >
            <Avatar src={summary.image} name={summary.name} sizes='6rem' />
          </div>
          <div className='min-w-0'>
            <p className='truncate text-sm font-medium text-neutral-400'>
              {summary.title}
            </p>
            <p className='truncate text-2xl leading-tight font-semibold tracking-tight text-white sm:text-3xl'>
              {summary.name}
            </p>
            {personality && (
              <p className='text-plex mt-1 flex items-center gap-1.5 text-sm font-semibold'>
                <personality.Icon className='size-4 shrink-0' aria-hidden />
                <span className='sr-only'>{`${personality.label}: `}</span>
                <span className='truncate'>{personality.name}</span>
              </p>
            )}
          </div>
        </div>

        <div className='mt-5 grid items-start gap-5 sm:mt-6 sm:grid-cols-2 sm:gap-8'>
          {tops.length > 0 && (
            <ul className='grid grid-cols-3 gap-3'>
              {tops.map(({ type, label, item, srcs }) => {
                const deeplink = getRowDeeplink(
                  item,
                  type,
                  userRewind.media_server,
                )
                const poster = (
                  <div className='poster w-full sm:w-full'>
                    <PosterImage
                      srcs={srcs}
                      type={type}
                      sizes='(min-width: 640px) 8rem, 30vw'
                    />
                  </div>
                )

                return (
                  <li
                    key={type}
                    className={clsx('min-w-0', deeplink && 'media-link-group')}
                  >
                    {deeplink ? (
                      <MediaServerLink
                        title={item.title}
                        mediaServer={deeplink.mediaServer}
                        ratingKey={deeplink.ratingKey}
                        isDuplicate
                        className='block'
                      >
                        {poster}
                      </MediaServerLink>
                    ) : (
                      poster
                    )}
                    <p className='mt-2 truncate text-xs text-neutral-400'>
                      {label}
                    </p>
                    <p className='truncate text-sm font-medium text-white'>
                      {deeplink ? (
                        <MediaServerLink
                          title={item.title}
                          mediaServer={deeplink.mediaServer}
                          ratingKey={deeplink.ratingKey}
                          className='media-link-title'
                        >
                          {item.title}
                        </MediaServerLink>
                      ) : (
                        item.title
                      )}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}

          <SummaryStatList
            stats={summary.stats}
            className='glass-sheet rounded-2xl'
          />
        </div>

        <div className='mt-5 sm:mt-6'>
          {/* Not disabled while busy, which would drop the focus, so the
              arrow keys would step the story. Smaller on phones, so both fit
              on a row in every language. */}
          <div className='flex gap-2 sm:gap-3'>
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
                onClick={() => share('share')}
                aria-disabled={isBusy}
              >
                {status === 'sharing' ? (
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
