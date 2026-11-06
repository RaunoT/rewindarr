import { describe, expect, it } from 'vitest'
import { getCallbackPath } from './callbackUrl'

describe('getCallbackPath', () => {
  it('keeps a path on this site with its query', () => {
    expect(getCallbackPath('/rewind')).toBe('/rewind')
    expect(getCallbackPath('/history?q=alien&page=2')).toBe(
      '/history?q=alien&page=2',
    )
  })

  it('falls back to the home page without one', () => {
    expect(getCallbackPath(null)).toBe('/')
    expect(getCallbackPath(undefined)).toBe('/')
    expect(getCallbackPath('')).toBe('/')
  })

  it('refuses addresses on other sites', () => {
    expect(getCallbackPath('https://example.com/rewind')).toBe('/')
    expect(getCallbackPath('//example.com/rewind')).toBe('/')
    expect(getCallbackPath('/\\example.com/rewind')).toBe('/')
    expect(getCallbackPath('javascript:alert(1)')).toBe('/')
  })

  it('refuses a path that leads to another site once cleaned up', () => {
    expect(getCallbackPath('/a/..//example.com/landing')).toBe('/')
    expect(getCallbackPath('/a/../\\example.com')).toBe('/')
  })

  it('falls back to the home page for an address that cannot be read', () => {
    expect(getCallbackPath('//[')).toBe('/')
  })
})
