import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings from '@/utils/getSettings'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/utils/getSettings', () => ({ default: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/health', () => {
  it('returns 200 ok when settings load', async () => {
    vi.mocked(getSettings).mockReturnValue(DEFAULT_SETTINGS)

    const res = GET()

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'ok' })
  })

  it('returns 503 error when reading settings throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(getSettings).mockImplementation(() => {
      throw new Error('EACCES')
    })

    const res = GET()

    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toEqual({ status: 'error' })
    expect(errorSpy).toHaveBeenCalled()
  })
})
