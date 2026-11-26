import { EmailSettings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import { describe, expect, it } from 'vitest'
import {
  ADDRESS_FIELD_PREFIX,
  ADDRESS_USERS_FIELD,
  INVITE_USERS_FIELD,
  INVITED_FIELD,
  readEmailForm,
  SUBSCRIBED_FIELD,
  SUBSCRIPTION_USERS_FIELD,
  WAS_INVITED_FIELD,
  WAS_SUBSCRIBED_FIELD,
} from './emailForm'

const SAVED: EmailSettings = {
  ...DEFAULT_SETTINGS.email,
  addresses: { 1: 'one@example.com', 9: 'nine@example.com' },
  unsubscribed: ['2', '9'],
  inviteUnsubscribed: ['5'],
}

function toFormData(fields: [string, string][]): FormData {
  const formData = new FormData()

  for (const [name, value] of fields) {
    formData.append(name, value)
  }

  return formData
}

const SERVER_FIELDS: [string, string][] = [
  ['smtpHost', ' smtp.example.com '],
  ['smtpPort', '465'],
  ['smtpSecurity', 'tls'],
  ['smtpUser', 'rewindarr'],
  ['smtpPassword', ' secret '],
  ['fromAddress', 'rewindarr@example.com'],
  ['fromName', 'Rewindarr'],
  ['appUrl', 'https://rewind.example.com/'],
  ['locale', 'et'],
]

describe('readEmailForm', () => {
  it('reads the mail server, keeping spaces in the password', () => {
    expect(readEmailForm(toFormData(SERVER_FIELDS), SAVED)).toMatchObject({
      smtpHost: 'smtp.example.com',
      smtpPort: 465,
      smtpSecurity: 'tls',
      smtpPassword: ' secret ',
      appUrl: 'https://rewind.example.com',
      locale: 'et',
      isNewsletterActive: false,
    })
  })

  it("keeps the newsletter's settings while it's off", () => {
    const data = readEmailForm(toFormData(SERVER_FIELDS), SAVED)

    expect(data).not.toHaveProperty('newsletterFrequency')
    expect(data).not.toHaveProperty('newsletterSections')
  })

  it('reads the newsletter, keeping the weekday of a monthly one', () => {
    const data = readEmailForm(
      toFormData([
        ...SERVER_FIELDS,
        ['isNewsletterActive', 'on'],
        ['newsletterFrequency', 'monthly'],
        ['newsletterWeekday', '3'],
        ['newsletterMonthDay', '10'],
        ['newsletterHour', '18'],
        ['newsletterSections', 'personal'],
        ['newsletterSections', 'topUsers'],
      ]),
      SAVED,
    )

    expect(data).toMatchObject({
      isNewsletterActive: true,
      newsletterFrequency: 'monthly',
      newsletterMonthDay: 10,
      newsletterHour: 18,
      newsletterSections: ['personal', 'topUsers'],
    })
    expect(data).not.toHaveProperty('newsletterWeekday')
  })

  it('only changes the users the form listed', () => {
    const data = readEmailForm(
      toFormData([
        ...SERVER_FIELDS,
        [ADDRESS_USERS_FIELD, '1'],
        [ADDRESS_USERS_FIELD, '2'],
        [ADDRESS_USERS_FIELD, '3'],
        [`${ADDRESS_FIELD_PREFIX}1`, ''],
        [`${ADDRESS_FIELD_PREFIX}2`, ' two@example.com '],
        [`${ADDRESS_FIELD_PREFIX}3`, ''],
        [SUBSCRIPTION_USERS_FIELD, '1'],
        [SUBSCRIPTION_USERS_FIELD, '2'],
        [SUBSCRIPTION_USERS_FIELD, '3'],
        [WAS_SUBSCRIBED_FIELD, '1'],
        [WAS_SUBSCRIBED_FIELD, '3'],
        [SUBSCRIBED_FIELD, '1'],
        [SUBSCRIBED_FIELD, '2'],
      ]),
      SAVED,
    )

    expect(data.addresses).toEqual({
      2: 'two@example.com',
      9: 'nine@example.com',
    })
    expect(data.unsubscribed).toEqual(['9', '3'])
  })

  it('keeps an unsubscribe that came after the form was opened', () => {
    const data = readEmailForm(
      toFormData([
        ...SERVER_FIELDS,
        [SUBSCRIPTION_USERS_FIELD, '2'],
        [WAS_SUBSCRIBED_FIELD, '2'],
        [SUBSCRIBED_FIELD, '2'],
      ]),
      SAVED,
    )

    expect(data.unsubscribed).toEqual(['2', '9'])
  })

  it('reads the invites apart from the newsletter', () => {
    const data = readEmailForm(
      toFormData([
        ...SERVER_FIELDS,
        [INVITE_USERS_FIELD, '1'],
        [INVITE_USERS_FIELD, '5'],
        [WAS_INVITED_FIELD, '1'],
        [INVITED_FIELD, '5'],
      ]),
      SAVED,
    )

    expect(data.inviteUnsubscribed).toEqual(['1'])
    expect(data).not.toHaveProperty('unsubscribed')
  })

  it('keeps the subscriptions while the newsletter list is hidden', () => {
    const data = readEmailForm(
      toFormData([
        ...SERVER_FIELDS,
        [ADDRESS_USERS_FIELD, '2'],
        [`${ADDRESS_FIELD_PREFIX}2`, 'two@example.com'],
      ]),
      SAVED,
    )

    expect(data.addresses).toMatchObject({ 2: 'two@example.com' })
    expect(data).not.toHaveProperty('unsubscribed')
  })

  it("keeps the users' settings when they weren't listed", () => {
    const data = readEmailForm(toFormData(SERVER_FIELDS), SAVED)

    expect(data).not.toHaveProperty('addresses')
    expect(data).not.toHaveProperty('unsubscribed')
    expect(data).not.toHaveProperty('inviteUnsubscribed')
  })
})
