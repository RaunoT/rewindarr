import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fadeTo, shouldFadeOut } from './useStoryMusic'

function makePlayer({
  volume = 0,
  paused = true,
  readOnlyVolume = false,
}: {
  volume?: number
  paused?: boolean
  readOnlyVolume?: boolean
} = {}) {
  const audio = {
    paused,
    pause: vi.fn(),
  } as unknown as HTMLAudioElement

  if (readOnlyVolume) {
    Object.defineProperty(audio, 'volume', {
      get: () => volume,
      set: () => {},
    })
  } else {
    audio.volume = volume
  }

  return {
    audio,
    fade: null,
    listeners: new AbortController(),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('shouldFadeOut', () => {
  it('skips already silent paused players without an active fade', () => {
    expect(shouldFadeOut(makePlayer({ volume: 0, paused: true }))).toBe(false)
    expect(shouldFadeOut(makePlayer({ volume: 0.7, paused: true }))).toBe(true)
    expect(shouldFadeOut(makePlayer({ volume: 0, paused: false }))).toBe(true)
  })
})

describe('fadeTo', () => {
  it('skips spawning a timer when already at the target volume', () => {
    const player = makePlayer({ volume: 0, paused: false })
    const onDone = vi.fn()

    fadeTo(player, 0, onDone)

    expect(player.fade).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('pauses immediately without a timer when volume is read-only (iOS Safari)', () => {
    const player = makePlayer({
      volume: 1,
      paused: false,
      readOnlyVolume: true,
    })
    const onDone = vi.fn(() => player.audio.pause())

    fadeTo(player, 0, onDone)

    expect(player.fade).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    expect(player.audio.pause).toHaveBeenCalledTimes(1)
  })

  it('fades smoothly over 800ms when volume is controllable', () => {
    const player = makePlayer({ volume: 0, paused: false })
    const onDone = vi.fn()

    fadeTo(player, 0.7, onDone)

    expect(player.fade).not.toBeNull()
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(400)
    expect(player.audio.volume).toBeGreaterThan(0)
    expect(player.audio.volume).toBeLessThan(0.7)
    expect(onDone).not.toHaveBeenCalled()

    vi.advanceTimersByTime(400)
    expect(player.audio.volume).toBe(0.7)
    expect(player.fade).toBeNull()
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
