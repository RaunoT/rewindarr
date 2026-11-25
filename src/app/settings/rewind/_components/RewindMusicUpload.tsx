'use client'

import { RewindMusic } from '@/types/settings'
import { REWIND_MUSIC_MAX_BYTES, REWIND_MUSIC_TYPES } from '@/utils/constants'
import { bytesToSize } from '@/utils/formatting'
import { clearNowPlaying, showAppInNowPlaying } from '@/utils/mediaSession'
import { PlayIcon, StopIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { ChangeEvent, useEffect, useRef, useState } from 'react'

type Props = {
  initialMusic: RewindMusic | null
}

const MUSIC_URL = '/api/rewind/music'
const ACCEPT = Object.keys(REWIND_MUSIC_TYPES)
  .map((extension) => `.${extension}`)
  .join(',')

// "Song.mp3" is shown as "Song", with "MP3" next to its size
function getFileName(fileName: string) {
  const dot = fileName.lastIndexOf('.')

  return dot > 0
    ? { name: fileName.slice(0, dot), extension: fileName.slice(dot + 1) }
    : { name: fileName, extension: '' }
}

// A paused track stays on the lock screen, so it's unloaded too
function release(audio: HTMLAudioElement | null) {
  if (!audio) {
    return
  }

  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  clearNowPlaying()
}

// Saved as soon as it's chosen, apart from the rest of the form
export default function RewindMusicUpload({ initialMusic }: Props) {
  const t = useTranslations('Settings.Rewind')
  const translations = useTranslations()
  const [music, setMusic] = useState(initialMusic)
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const maxSize = bytesToSize(REWIND_MUSIC_MAX_BYTES, 0, translations) ?? ''
  const fileName = music ? getFileName(music.name) : null

  function getError(code: string) {
    if (code === 'type') {
      return t('musicTypeError')
    }

    if (code === 'size') {
      return t('musicSizeError', { size: maxSize })
    }

    return t('musicError')
  }

  // A detached player keeps playing after the page is left
  useEffect(() => () => detach(), [])

  // Clears the ref first, so a late event from the unloaded player doesn't
  // count as the one in use
  function detach() {
    const audio = audioRef.current

    audioRef.current = null
    release(audio)
  }

  function stop() {
    detach()
    setIsPlaying(false)
  }

  function togglePlay() {
    if (isPlaying || !music) {
      stop()

      return
    }

    const audio = new Audio(`${MUSIC_URL}?v=${music.updatedAt}`)
    // Only the player still in use may reset the button
    const end = () => audioRef.current === audio && stop()

    audio.addEventListener('ended', end)
    audio.addEventListener('error', end)
    audioRef.current = audio
    setIsPlaying(true)
    showAppInNowPlaying()
    audio.play().catch(end)
  }

  async function send(init: RequestInit) {
    // The track it played is about to change
    stop()
    setIsBusy(true)
    setError('')

    try {
      const response = await fetch(MUSIC_URL, init)
      const result = await response.json()

      if (response.ok) {
        setMusic(result.music)
      } else {
        setError(getError(result.error))
      }
    } catch {
      setError(getError(''))
    } finally {
      setIsBusy(false)
    }
  }

  function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]

    // Lets the same file be picked again after an error
    e.target.value = ''

    if (!file) {
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

    if (!Object.hasOwn(REWIND_MUSIC_TYPES, extension)) {
      setError(getError('type'))

      return
    }

    if (file.size > REWIND_MUSIC_MAX_BYTES) {
      setError(getError('size'))

      return
    }

    send({
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': REWIND_MUSIC_TYPES[extension],
        'X-File-Name': encodeURIComponent(file.name),
      },
    })
  }

  return (
    <div className='input-wrapper'>
      <div className='flex min-w-0 flex-1 flex-col items-start gap-3'>
        {music && fileName && (
          // A grid column that can shrink to nothing, as the settings' grid
          // would otherwise widen to fit a long name
          <div className='grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2'>
            <button
              type='button'
              className='icon-button'
              onClick={togglePlay}
              // The track may be on its way out
              disabled={isBusy}
              aria-label={isPlaying ? t('musicStop') : t('musicPlay')}
            >
              {isPlaying ? <StopIcon /> : <PlayIcon />}
            </button>
            <div>
              <p className='truncate text-sm font-medium'>{fileName.name}</p>
              <p className='text-xs text-neutral-400'>
                {t('musicFileDetails', {
                  format: fileName.extension.toUpperCase(),
                  size: bytesToSize(music.size, 1, translations) ?? '',
                })}
              </p>
            </div>
          </div>
        )}
        <div className='flex flex-wrap items-center gap-4'>
          <button
            type='button'
            className='button button-sm'
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
          >
            {isBusy
              ? t('musicSaving')
              : music
                ? t('musicReplace')
                : t('musicUpload')}
          </button>
          {music && (
            <>
              {/* The file name comes from the response */}
              <a
                href={`${MUSIC_URL}?download&v=${music.updatedAt}`}
                download
                className='link text-sm'
                aria-disabled={isBusy}
                // Links can't be disabled, and the file may be changing
                onClick={(e) => isBusy && e.preventDefault()}
              >
                {t('musicDownload')}
              </a>
              <button
                type='button'
                className='link text-sm'
                onClick={() => send({ method: 'DELETE' })}
                disabled={isBusy}
              >
                {t('musicRemove')}
              </button>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type='file'
          accept={ACCEPT}
          className='hidden'
          onChange={upload}
          tabIndex={-1}
          aria-hidden='true'
        />
        {error && (
          <p className='text-danger text-xs' role='alert'>
            {error}
          </p>
        )}
      </div>
      <span className='label label--start'>
        <span className='label-wrapper'>{t('musicTrack')}</span>
        <small>{t('musicTrackDescription', { size: maxSize })}</small>
      </span>
    </div>
  )
}
