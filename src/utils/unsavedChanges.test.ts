import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getFormSnapshot,
  getLeavingPath,
  guardLeave,
  setLeaveGuard,
} from './unsavedChanges'

describe('getFormSnapshot', () => {
  it('matches the same values in another order', () => {
    expect(
      getFormSnapshot([
        ['serverName', 'Home'],
        ['links', 'imdb'],
        ['links', 'tmdb'],
      ]),
    ).toBe(
      getFormSnapshot([
        ['links', 'tmdb'],
        ['serverName', 'Home'],
        ['links', 'imdb'],
      ]),
    )
  })

  it('tells a changed, added or removed value apart', () => {
    const saved = getFormSnapshot([
      ['serverName', 'Home'],
      ['isAnonymized', 'on'],
    ])

    expect(getFormSnapshot([['serverName', 'Home']])).not.toBe(saved)
    expect(
      getFormSnapshot([
        ['serverName', 'Away'],
        ['isAnonymized', 'on'],
      ]),
    ).not.toBe(saved)
    expect(
      getFormSnapshot([
        ['serverName', 'Home'],
        ['isAnonymized', 'on'],
        ['isOutsideAccess', 'on'],
      ]),
    ).not.toBe(saved)
  })

  it('keeps the order of values whose order is saved', () => {
    const ordered = ['activeLibraries']

    expect(
      getFormSnapshot(
        [
          ['activeLibraries', 'movies'],
          ['activeLibraries', 'shows'],
        ],
        ordered,
      ),
    ).not.toBe(
      getFormSnapshot(
        [
          ['activeLibraries', 'shows'],
          ['activeLibraries', 'movies'],
        ],
        ordered,
      ),
    )
  })

  it('leaves out files and the action fields', () => {
    const file = new File(['a'], 'track.mp3')

    expect(
      getFormSnapshot([
        ['serverName', 'Home'],
        ['music', file],
        ['$ACTION_ID_abc', ''],
      ]),
    ).toBe(getFormSnapshot([['serverName', 'Home']]))
  })
})

describe('getLeavingPath', () => {
  const location = new URL('http://localhost:3000/settings/general')
  const click = { button: 0, hasModifier: false }

  it('returns the path of another page in the app', () => {
    expect(
      getLeavingPath({ ...click, href: '/settings/rewind?a=1#x' }, location),
    ).toBe('/settings/rewind?a=1#x')
    expect(
      getLeavingPath(
        { ...click, href: 'http://localhost:3000/history' },
        location,
      ),
    ).toBe('/history')
  })

  it('ignores links that stay on the page', () => {
    expect(
      getLeavingPath({ ...click, href: '/settings/general' }, location),
    ).toBeNull()
    expect(getLeavingPath({ ...click, href: '#top' }, location)).toBeNull()
  })

  it('ignores links that open elsewhere or leave the app', () => {
    const href = '/settings/rewind'

    expect(
      getLeavingPath({ ...click, href, target: '_blank' }, location),
    ).toBeNull()
    expect(
      getLeavingPath({ ...click, href, hasModifier: true }, location),
    ).toBeNull()
    expect(getLeavingPath({ ...click, href, button: 1 }, location)).toBeNull()
    expect(
      getLeavingPath({ ...click, href, isDownload: true }, location),
    ).toBeNull()
    expect(
      getLeavingPath({ ...click, href: 'https://github.com/' }, location),
    ).toBeNull()
  })

  it('ignores disabled links', () => {
    expect(
      getLeavingPath(
        { ...click, href: '/settings/rewind', isDisabled: true },
        location,
      ),
    ).toBeNull()
  })

  it('keeps a link that targets this tab', () => {
    expect(
      getLeavingPath(
        { ...click, href: '/settings/rewind', target: '_self' },
        location,
      ),
    ).toBe('/settings/rewind')
  })
})

describe('guardLeave', () => {
  afterEach(() => {
    setLeaveGuard(null)
  })

  it('leaves straight away without a guard', () => {
    const leave = vi.fn()

    guardLeave(leave)

    expect(leave).toHaveBeenCalledOnce()
  })

  it('hands the leave to the guard', () => {
    const leave = vi.fn()
    const guard = vi.fn()

    setLeaveGuard(guard)
    guardLeave(leave)

    expect(leave).not.toHaveBeenCalled()
    expect(guard).toHaveBeenCalledWith(leave)
  })
})
