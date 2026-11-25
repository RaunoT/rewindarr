import { describe, expect, it } from 'vitest'
import { SAVED_API_KEY } from './connectionSecrets'
import {
  getMailErrorKey,
  isMailServerSet,
  MailServer,
  maskMailPassword,
  restoreMailPassword,
} from './mailer'

const SERVER: MailServer = {
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpSecurity: 'starttls',
  smtpUser: 'rewindarr',
  smtpPassword: 'secret',
  fromAddress: 'rewindarr@example.com',
  fromName: 'Rewindarr',
}

describe('isMailServerSet', () => {
  it('needs a host, port and from address', () => {
    expect(isMailServerSet(SERVER)).toBe(true)
    expect(isMailServerSet({ ...SERVER, smtpHost: '' })).toBe(false)
    expect(isMailServerSet({ ...SERVER, fromAddress: '' })).toBe(false)
  })
})

describe('maskMailPassword', () => {
  it('hides the saved password', () => {
    expect(maskMailPassword(SERVER).smtpPassword).toBe(SAVED_API_KEY)
  })

  it('keeps a password that was just typed', () => {
    expect(
      maskMailPassword({ ...SERVER, smtpPassword: 'typed' }, SERVER)
        .smtpPassword,
    ).toBe('typed')
  })

  it('leaves an empty one empty', () => {
    expect(maskMailPassword({ ...SERVER, smtpPassword: '' }).smtpPassword).toBe(
      '',
    )
  })
})

describe('restoreMailPassword', () => {
  const masked = { ...SERVER, smtpPassword: SAVED_API_KEY }

  it('puts the saved password back', () => {
    expect(restoreMailPassword(masked, SERVER)?.smtpPassword).toBe('secret')
  })

  it("doesn't send it to another host or user", () => {
    expect(
      restoreMailPassword({ ...masked, smtpHost: 'evil.example.com' }, SERVER),
    ).toBeNull()
    expect(restoreMailPassword({ ...masked, smtpUser: 'other' }, SERVER)).toBe(
      null,
    )
  })

  it('keeps a new one', () => {
    expect(
      restoreMailPassword({ ...SERVER, smtpPassword: 'new' }, SERVER)
        ?.smtpPassword,
    ).toBe('new')
  })
})

describe('getMailErrorKey', () => {
  function error(code: string, message = '', responseCode?: number) {
    return Object.assign(new Error(message), { code, responseCode })
  }

  it('tells the common failures apart', () => {
    expect(getMailErrorKey(error('EAUTH'))).toBe('mailAuthFailed')
    expect(getMailErrorKey(error('ECONNECTION'))).toBe('mailUnableToConnect')
    expect(getMailErrorKey(error('ETIMEDOUT'))).toBe('mailUnableToConnect')
    expect(
      getMailErrorKey(error('ESOCKET', 'self-signed certificate in chain')),
    ).toBe('mailCertificateError')
    expect(getMailErrorKey(error('EENVELOPE'))).toBe('mailRejected')
    expect(
      getMailErrorKey(error('EENVELOPE', 'Authentication Required', 530)),
    ).toBe('mailAuthRequired')
    expect(
      getMailErrorKey(error('EAUTH', 'Application-specific password', 534)),
    ).toBe('mailAuthFailed')
    expect(getMailErrorKey(error('EMESSAGE', 'Rejected', 553))).toBe(
      'mailRejected',
    )
    expect(getMailErrorKey(new Error('Something else'))).toBe('mailFailed')
    expect(getMailErrorKey(undefined)).toBe('mailFailed')
  })
})
