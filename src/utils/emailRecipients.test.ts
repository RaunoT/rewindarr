import { Settings } from '@/types/settings'
import { SourceUser } from '@/types/statsSource'
import { cloneDeep } from 'lodash'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './constants'
import { isEmailAddress, toEmailRecipient } from './emailRecipients'

let settings: Settings

const USER: SourceUser = {
  is_admin: 0,
  is_restricted: 0,
  is_active: 1,
  user_id: '42',
  friendly_name: 'Alex',
  thumb: 'https://plex.tv/users/42/avatar',
  user_thumb: '',
  username: 'alex',
  email: 'alex@example.com',
  shared_libraries: [],
}

beforeEach(() => {
  settings = cloneDeep(DEFAULT_SETTINGS)
})

describe('isEmailAddress', () => {
  it('takes anything shaped like an address', () => {
    expect(isEmailAddress('alex@example.com')).toBe(true)
    expect(isEmailAddress('alex+rewind@mail.example.co.uk')).toBe(true)
    expect(isEmailAddress('alex')).toBe(false)
    expect(isEmailAddress('alex@example')).toBe(false)
    expect(isEmailAddress('alex @example.com')).toBe(false)
  })
})

describe('toEmailRecipient', () => {
  it("uses the source's address", () => {
    expect(toEmailRecipient(settings, USER, null)).toEqual({
      id: '42',
      name: 'Alex',
      thumb: 'https://plex.tv/users/42/avatar',
      customAddress: '',
      foundAddress: 'alex@example.com',
      address: 'alex@example.com',
      isSubscribed: true,
    })
  })

  it("puts the admin's address first", () => {
    settings.email.addresses = { 42: 'alex@home.example.com' }

    expect(toEmailRecipient(settings, USER, null)).toMatchObject({
      customAddress: 'alex@home.example.com',
      foundAddress: 'alex@example.com',
      address: 'alex@home.example.com',
    })
  })

  it("falls back to Seerr's", () => {
    const seerr = new Map([['42', 'alex@seerr.example.com']])

    expect(
      toEmailRecipient(settings, { ...USER, email: '' }, seerr).address,
    ).toBe('alex@seerr.example.com')
  })

  it("matches Jellyfin's IDs with or without dashes", () => {
    const seerr = new Map([['0a1b2c', 'sam@example.com']])

    settings.connection.mediaServerType = 'jellyfin'

    expect(
      toEmailRecipient(
        settings,
        { ...USER, user_id: '0A1B-2C', email: '' },
        seerr,
      ).address,
    ).toBe('sam@example.com')
  })

  it('has no address without one anywhere', () => {
    expect(
      toEmailRecipient(settings, { ...USER, email: '' }, null).address,
    ).toBe('')
  })

  it('knows who unsubscribed', () => {
    settings.email.unsubscribed = ['42']

    expect(toEmailRecipient(settings, USER, null).isSubscribed).toBe(false)
  })
})
