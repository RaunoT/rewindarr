import { showAppInNowPlaying } from '@/utils/mediaSession'
import { useCallback, useEffect, useRef, useState } from 'react'

type Player = {
  audio: HTMLAudioElement
  fade: ReturnType<typeof setInterval> | null
  listeners: AbortController
}

type Options = {
  // What the current story plays, in order of preference
  sources: string[]
  isPlaying: boolean
  // When the browser won't play before the visitor interacts with the page
  onBlocked: () => void
}

const VOLUME = 0.7
const FADE_DURATION = 800
// Timers keep running in a hidden tab, where animation frames would stop
// before the music fades out
const FADE_STEP = 50

// Plays the first of the story's sources that loads, fading between tracks.
// Each track picks up where it left off.
export default function useStoryMusic({
  sources,
  isPlaying,
  onBlocked,
}: Options) {
  const playersRef = useRef(new Map<string, Player>())
  const onBlockedRef = useRef(onBlocked)
  const [failed, setFailed] = useState<string[]>([])
  const current = sources.find((url) => !failed.includes(url)) ?? null

  useEffect(() => {
    onBlockedRef.current = onBlocked
  }, [onBlocked])

  const getPlayer = useCallback((url: string) => {
    let player = playersRef.current.get(url)

    if (!player) {
      const audio = new Audio(url)
      const listeners = new AbortController()

      audio.loop = true
      audio.volume = 0
      // A missing theme song falls back to the next source
      audio.addEventListener(
        'error',
        () => setFailed((prev) => (prev.includes(url) ? prev : [...prev, url])),
        { signal: listeners.signal },
      )
      player = { audio, fade: null, listeners }
      playersRef.current.set(url, player)
    }

    return player
  }, [])
  const play = useCallback(
    (url: string) => {
      const player = getPlayer(url)

      showAppInNowPlaying()
      player.audio.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          onBlockedRef.current()
        }
      })
      fadeTo(player, VOLUME)
    },
    [getPlayer],
  )
  // Called from the click that turns the sound on. Browsers only let audio
  // start on a click, and Safari remembers it per track, so every track is
  // started here, even the ones the current story doesn't play.
  const unlock = useCallback(
    (urls: string[]) => {
      for (const url of urls) {
        if (url === current) {
          play(url)
        } else if (!failed.includes(url)) {
          const { audio } = getPlayer(url)

          audio.play().catch(() => {})
          audio.pause()
        }
      }
    },
    [current, failed, getPlayer, play],
  )

  useEffect(() => {
    for (const [url, player] of playersRef.current) {
      if ((url !== current || !isPlaying) && shouldFadeOut(player)) {
        fadeTo(player, 0, () => player.audio.pause())
      }
    }

    if (current && isPlaying) {
      play(current)
    }
  }, [current, isPlaying, play])

  useEffect(() => {
    const players = playersRef.current

    return () => {
      for (const { audio, fade, listeners } of players.values()) {
        if (fade) {
          clearInterval(fade)
        }

        // Emptying the source isn't the track failing
        listeners.abort()
        audio.pause()
        // Stops the download too
        audio.removeAttribute('src')
        audio.load()
      }

      players.clear()
    }
  }, [])

  return { unlock }
}

export function shouldFadeOut(player: Pick<Player, 'audio' | 'fade'>): boolean {
  return !player.audio.paused || !!player.fade || player.audio.volume > 0
}

// iOS ignores writes to `audio.volume`, leaving it at 1
function canControlVolume(audio: HTMLAudioElement): boolean {
  const before = audio.volume
  const probe = before > 0.5 ? before - 0.01 : before + 0.01

  audio.volume = probe

  const changed = Math.abs(audio.volume - before) > 0.001

  audio.volume = before

  return changed
}

export function fadeTo(player: Player, target: number, onDone?: () => void) {
  if (player.fade) {
    clearInterval(player.fade)
    player.fade = null
  }

  const from = player.audio.volume

  if (Math.abs(from - target) < 0.001 || !canControlVolume(player.audio)) {
    player.audio.volume = target
    onDone?.()

    return
  }

  const start = performance.now()
  const fade = setInterval(() => {
    const progress = Math.min((performance.now() - start) / FADE_DURATION, 1)

    player.audio.volume = from + (target - from) * progress

    if (progress === 1) {
      clearInterval(fade)
      player.fade = null
      onDone?.()
    }
  }, FADE_STEP)

  player.fade = fade
}
