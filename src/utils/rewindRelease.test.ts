import { Settings } from '@/types/settings'
import { cloneDeep } from 'lodash'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './constants'
import { EmailRecipient, getEmailRecipients } from './emailRecipients'
import { sendRewindEmails } from './emailSend'
import getSettings from './getSettings'
import { checkRewindRelease } from './rewindRelease'

vi.mock('./getSettings', () => ({ default: vi.fn() }))
vi.mock('./emailRecipients', () => ({ getEmailRecipients: vi.fn() }))
vi.mock('./emailSend', () => ({ sendRewindEmails: vi.fn() }))
vi.mock('./mailer', () => ({ isMailServerSet: () => true }))
vi.mock('./files', () => ({
  getErrorCode: () => 'ENOENT',
  replaceFile: vi.fn(),
}))
vi.mock('fs/promises', () => ({
  default: { readFile: vi.fn(async () => Promise.reject(new Error())) },
}))

function recipient(
  id: string,
  fields: Partial<EmailRecipient> = {},
): EmailRecipient {
  return {
    id,
    name: id,
    thumb: null,
    customAddress: '',
    foundAddress: `${id}@example.com`,
    address: `${id}@example.com`,
    isSubscribed: true,
    isInvited: true,
    ...fields,
  }
}

let settings: Settings

beforeEach(() => {
  settings = cloneDeep(DEFAULT_SETTINGS)
  settings.setupComplete = true
  settings.rewind.isReleaseEmailActive = true
  vi.mocked(getSettings).mockReturnValue(settings)
  vi.mocked(sendRewindEmails).mockReset()
  vi.mocked(sendRewindEmails).mockResolvedValue({
    status: 'done',
    outcomes: [],
  })
})

describe('checkRewindRelease', () => {
  it('invites the users with an address who get the invites', async () => {
    vi.mocked(getEmailRecipients).mockResolvedValue([
      recipient('1'),
      recipient('2', { isInvited: false }),
      recipient('3', { address: '' }),
      recipient('4', { isSubscribed: false }),
    ])

    // The day after the 2026 edition's release day
    await checkRewindRelease(new Date(2026, 11, 2, 12))

    expect(sendRewindEmails).toHaveBeenCalledWith(settings, ['1', '4'])
  })
})
