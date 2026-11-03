'use client'

import { GlobalContext } from '@/app/_components/GlobalContextProvider'
import MediaCard, { STAT_PILL } from '@/components/MediaCard'
import PlaybackOverlay from '@/components/PlaybackOverlay'
import ProgressBar from '@/components/ProgressBar'
import { DECISION_ICONS, getDecisionKind } from '@/components/StreamDecision'
import { useMediaDetails } from '@/hooks/useMediaDetails'
import { PublicSettings } from '@/types/settings'
import { MediaServer } from '@/types/statsSource'
import { TautulliSession } from '@/types/tautulli'
import { getDeeplinkRatingKeyFromSession } from '@/utils/deeplink'
import {
  calculateETA,
  formatBitrate,
  formatChannels,
  formatCodec,
  formatDevice,
  formatDynamicRange,
  formatPercent,
  formatResolution,
  millisecondsToTimeString,
} from '@/utils/formatting'
import { ArrowTurnDownRightIcon } from '@heroicons/react/16/solid'
import { ChevronDownIcon, DeviceTabletIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { capitalize, toUpper } from 'lodash'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { ReactNode, useContext, useId, useState } from 'react'

type ActivityItemProps = {
  session: TautulliSession
  index: number
  settings: PublicSettings
  mediaServer: MediaServer | null
}

export default function ActivityItem({
  session,
  index,
  settings,
  mediaServer,
}: ActivityItemProps) {
  const { posterUrl, isPosterLoading, details, isDetailsLoading } =
    useMediaDetails(session, settings)
  const t = useTranslations('Activity')
  const tHistory = useTranslations('History')
  const locale = useLocale()
  const { data: user } = useSession()
  const isCurrentUser = String(session.user_id) === user?.user.id
  const deeplinkRatingKey = getDeeplinkRatingKeyFromSession(session)
  const isAdmin = user?.user.isAdmin
  const {
    activity: { isDetailsHidden, setIsDetailsHidden },
  } = useContext(GlobalContext)
  // Each card opens the way the last one was left, and keeps its own state
  const [isExpanded, setIsExpanded] = useState(!isDetailsHidden)
  const detailsId = useId()
  const {
    audio_atmos,
    audio_channel_layout,
    audio_codec,
    bandwidth,
    bitrate,
    container,
    friendly_name,
    grandparent_title,
    ip_address,
    ip_address_public,
    location,
    media_index,
    media_type,
    parent_media_index,
    player,
    product,
    quality_profile,
    state,
    stream_audio_atmos,
    stream_audio_channel_layout,
    stream_audio_codec,
    stream_audio_decision,
    stream_audio_language,
    stream_bitrate,
    stream_container,
    stream_container_decision,
    stream_subtitle_codec,
    stream_subtitle_decision,
    stream_subtitle_language,
    stream_video_codec,
    stream_video_decision,
    stream_video_dynamic_range,
    stream_video_full_resolution,
    subtitle_codec,
    title,
    transcode_decision,
    video_codec,
    video_dynamic_range,
    video_full_resolution,
  } = session

  function formatDecision(decision?: string) {
    const kind = getDecisionKind(decision)

    return kind ? t(`decision.${kind}`) : decision
  }

  const videoSource = joinParts(
    formatResolution(video_full_resolution),
    formatCodec(video_codec, 'video'),
    formatDynamicRange(video_dynamic_range),
  )
  const videoStream = joinParts(
    formatResolution(stream_video_full_resolution),
    formatCodec(stream_video_codec, 'video'),
    formatDynamicRange(stream_video_dynamic_range),
  )
  const audioSource = joinParts(
    formatCodec(audio_codec, 'audio'),
    isAtmos(audio_atmos) ? 'Atmos' : '',
    formatChannels(audio_channel_layout),
  )
  const audioStream = joinParts(
    formatCodec(stream_audio_codec, 'audio'),
    isAtmos(stream_audio_atmos) ? 'Atmos' : '',
    formatChannels(stream_audio_channel_layout),
  )
  const bitrateSource = formatBitrate(bitrate, locale)
  const bitrateStream = formatBitrate(stream_bitrate, locale)
  const qualityConversion = getConversion(
    bitrateSource,
    bitrateStream,
    transcode_decision,
  )
  const subtitleSource = formatCodec(subtitle_codec, 'subtitle')
  const subtitleStream = formatCodec(stream_subtitle_codec, 'subtitle')
  const isAnonymous = settings.general.isAnonymized && !isCurrentUser
  // The show or artist leads, and an episode goes by its numbers, as in the
  // history
  const name = grandparent_title || title
  const episode =
    media_type === 'episode' &&
    isPresent(parent_media_index) &&
    isPresent(media_index)
      ? tHistory('episodeNumber', {
          season: parent_media_index,
          episode: media_index,
        })
      : null
  const detail =
    media_type === 'episode'
      ? (episode ?? title)
      : name !== title
        ? title
        : null
  const fullTitle = [name, episode, name !== title && title]
    .filter(Boolean)
    .join(' · ')
  const position =
    session.duration && session.view_offset
      ? `${millisecondsToTimeString(parseInt(session.view_offset))} / ${millisecondsToTimeString(parseInt(session.duration))}`
      : null
  const eta = calculateETA(session.duration, session.view_offset, locale)
  // The player's name is a stream detail, so it hides with them
  const device = isExpanded ? formatDevice(product, player) : product || player
  const decisionKind = getDecisionKind(transcode_decision)
  const decisionIcon = decisionKind && DECISION_ICONS[decisionKind]

  function toggleDetails() {
    setIsExpanded(!isExpanded)
    // New cards, and the next visit, open the same way
    setIsDetailsHidden(isExpanded)
  }

  // Stream info: what is playing first, then how it gets there
  const streamDetails = isExpanded && (
    <ul
      id={detailsId}
      className='flex flex-wrap gap-x-6 gap-y-3 rounded-2xl bg-black/25 p-4 text-sm ring-1 ring-white/10 ring-inset'
    >
      {media_type !== 'track' && (
        <Detail
          label={t('video')}
          convertedTo={getConversion(
            videoSource,
            videoStream,
            stream_video_decision,
          )}
        >
          {formatValue(videoSource || videoStream)}
        </Detail>
      )}
      <Detail
        label={withLanguage(
          t('audio'),
          media_type !== 'track' && stream_audio_language,
        )}
        convertedTo={getConversion(
          audioSource,
          audioStream,
          stream_audio_decision,
        )}
      >
        {formatValue(audioSource || audioStream)}
      </Detail>
      {media_type !== 'track' && (subtitle_codec || stream_subtitle_codec) && (
        <Detail
          label={withLanguage(t('subtitles'), stream_subtitle_language)}
          convertedTo={
            stream_subtitle_decision === 'burn'
              ? t('decision.burnedIn')
              : getConversion(
                  subtitleSource,
                  subtitleStream,
                  stream_subtitle_decision,
                )
          }
        >
          {formatValue(subtitleSource || subtitleStream)}
        </Detail>
      )}
      {/* The profile names the bitrate it streams at, and bandwidth shows
              the real one, so the stream bitrate is only for no profile */}
      <Detail
        label={t('quality')}
        convertedTo={
          qualityConversion && (quality_profile || qualityConversion)
        }
      >
        {formatValue(
          !qualityConversion && quality_profile,
          bitrateSource || bitrateStream,
        )}
      </Detail>
      {/* TODO: Tautulli doesn't return bandwidth for tracks sometimes */}
      <Detail label={t('bandwidth')}>
        {formatValue(formatBitrate(bandwidth, locale))}
      </Detail>
      <Detail
        label={t('container')}
        convertedTo={getConversion(
          toUpper(container),
          toUpper(stream_container),
          stream_container_decision,
        )}
      >
        {formatValue(toUpper(container) || toUpper(stream_container))}
      </Detail>
      {isAdmin && !settings.general.isAnonymized && location && (
        <Detail label={t('location')}>
          {`${toUpper(location)} · `}
          {location === 'wan' ? (
            <a
              href={`https://ipinfo.io/${ip_address_public}`}
              target='_blank'
              rel='noopener noreferrer'
              className='underline decoration-white/30 underline-offset-2 transition-colors hover:decoration-white'
            >
              {ip_address_public}
            </a>
          ) : (
            ip_address
          )}
        </Detail>
      )}
    </ul>
  )

  return (
    <MediaCard
      type={TYPES[media_type as keyof typeof TYPES] ?? 'movie'}
      mediaType={media_type}
      item={details}
      isItemLoading={isDetailsLoading}
      name={name}
      detail={detail}
      fullTitle={fullTitle}
      posters={[posterUrl, details?.poster]}
      isPosterLoading={isPosterLoading}
      posterOverlay={<PlaybackOverlay state={state} className='size-7' />}
      isPriority
      user={{
        name: isAnonymous
          ? t('anonymous', { number: index + 1 })
          : friendly_name,
        avatar: session.user_thumb,
        isOwn: isCurrentUser,
        isAnonymous,
      }}
      stats={
        <>
          {device && (
            <li className={clsx(STAT_PILL, 'min-w-0')}>
              <DeviceTabletIcon />
              <span className='truncate'>{device}</span>
            </li>
          )}
          {/* How the stream gets there, which opens the rest. Its colour
              shows when the details are worth a look. Taps 10px above and
              below count too, for a 40px tap area. */}
          <li>
            <button
              type='button'
              className='icon-stat-wrapper focus-visible:focus-ring relative cursor-pointer pr-2 transition-colors after:absolute after:inset-x-0 after:-inset-y-2.5 hover:bg-white/10'
              aria-expanded={isExpanded}
              aria-controls={detailsId}
              onClick={toggleDetails}
            >
              {decisionIcon && (
                <decisionIcon.Icon className={decisionIcon.className} />
              )}
              {capitalize(formatDecision(transcode_decision))}
              <span className='sr-only'>{` (${t('streamDetails')})`}</span>
              <ChevronDownIcon
                className={clsx(
                  'transition-transform',
                  isExpanded && 'rotate-180',
                )}
              />
            </button>
          </li>
        </>
      }
      deeplink={
        mediaServer && deeplinkRatingKey
          ? { mediaServer, ratingKey: deeplinkRatingKey }
          : null
      }
      // Where the play is and when it ends, where a history card has its date
      aside={
        position && (
          <>
            <span className='block'>{position}</span>
            {eta && (
              <span className='block text-neutral-200'>
                {t('endsAt', { time: eta })}
              </span>
            )}
          </>
        )
      }
      settings={settings}
      footer={streamDetails}
    >
      {position && (
        <div className='flex items-center gap-3 text-xs text-neutral-400 tabular-nums sm:text-sm'>
          <ProgressBar
            value={Number(session.progress_percent) / 100}
            className='flex-1'
          />
          {formatPercent(Number(session.progress_percent), locale)}
        </div>
      )}
    </MediaCard>
  )
}

const TYPES = { movie: 'movie', episode: 'show', track: 'artist' } as const

function isPresent(value?: number | string | null): value is number | string {
  return value !== null && value !== ''
}

// Tautulli sends 0 or 1, Tracearr a boolean
function isAtmos(value?: number | boolean) {
  return Number(value) === 1
}

function isTranscoding(decision?: string) {
  return getDecisionKind(decision) === 'transcode'
}

function joinParts(...parts: string[]) {
  return parts.filter(Boolean).join(' ')
}

// What it becomes, only when Plex converts a known source to something else.
// Without the source, the stream is shown in its place instead.
function getConversion(source: string, stream: string, decision?: string) {
  return isTranscoding(decision) && source && stream && stream !== source
    ? stream
    : undefined
}

function withLanguage(label: string, language?: string | false) {
  return language ? `${label} (${language})` : label
}

function formatValue(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' · ') || '–'
}

type DetailProps = {
  label: string
  convertedTo?: string
  children: ReactNode
}

// The original stays on top and the conversion goes below it in gold, as
// converting is what costs the server
function Detail({ label, convertedTo, children }: DetailProps) {
  const t = useTranslations('Activity')

  return (
    <li>
      <div className='mb-0.5 text-xs text-neutral-400'>{label}</div>
      <div className='text-pretty'>{children}</div>
      {convertedTo && (
        <div className='text-plex flex gap-1'>
          <span className='flex h-[1lh] shrink-0 items-center'>
            <ArrowTurnDownRightIcon className='size-3.5' aria-hidden='true' />
          </span>
          <span>
            <span className='sr-only'>{t('convertedTo')} </span>
            {convertedTo}
          </span>
        </div>
      )}
    </li>
  )
}
