import { EmailSettings } from '@/types/settings'
import nodemailer from 'nodemailer'
import { SAVED_API_KEY } from './connectionSecrets'
import { APP_NAME } from './constants'

export type MailServer = Pick<
  EmailSettings,
  | 'smtpHost'
  | 'smtpPort'
  | 'smtpSecurity'
  | 'smtpUser'
  | 'smtpPassword'
  | 'fromAddress'
  | 'fromName'
>

export type OutgoingEmail = {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}

// Why an email didn't go, as a key of the Settings.Email messages
export type MailErrorKey =
  | 'mailAuthRequired'
  | 'mailAuthFailed'
  | 'mailUnableToConnect'
  | 'mailCertificateError'
  | 'mailRejected'
  | 'mailFailed'

export type SendResult =
  | { status: 'sent' }
  | { status: 'failed'; error: MailErrorKey }

const CONNECTION_TIMEOUT_MS = 15_000
const SOCKET_TIMEOUT_MS = 60_000

export function isMailServerSet(server: MailServer): boolean {
  return !!(server.smtpHost && server.smtpPort && server.fromAddress)
}

function createTransport(server: MailServer, pool: boolean) {
  const options = {
    host: server.smtpHost,
    port: server.smtpPort,
    secure: server.smtpSecurity === 'tls',
    // Refuses to go on in the clear when the server can't upgrade
    requireTLS: server.smtpSecurity === 'starttls',
    ignoreTLS: server.smtpSecurity === 'none',
    auth: server.smtpUser
      ? { user: server.smtpUser, pass: server.smtpPassword }
      : undefined,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: CONNECTION_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  }

  // One connection at a time, which home mail servers and free plans limit
  return pool
    ? nodemailer.createTransport({ ...options, pool: true, maxConnections: 1 })
    : nodemailer.createTransport(options)
}

export function getMailErrorKey(error: unknown): MailErrorKey {
  const { code, responseCode } = (error ?? {}) as {
    code?: string
    responseCode?: number
  }
  const message = error instanceof Error ? error.message : ''

  // Gmail and most others answer the first command with this until the app
  // signs in
  if (responseCode === 530) {
    return 'mailAuthRequired'
  }

  // 534 is Gmail's for an account password where it wants an app password
  if (code === 'EAUTH' || responseCode === 534 || responseCode === 535) {
    return 'mailAuthFailed'
  }

  if (
    code === 'ETLS' ||
    /certificate|self[- ]signed|wrong version number/i.test(message)
  ) {
    return 'mailCertificateError'
  }

  if (
    code === 'ECONNECTION' ||
    code === 'ETIMEDOUT' ||
    code === 'EDNS' ||
    code === 'ESOCKET' ||
    code === 'ECONNREFUSED'
  ) {
    return 'mailUnableToConnect'
  }

  if (code === 'EENVELOPE' || (responseCode && responseCode >= 550)) {
    return 'mailRejected'
  }

  return 'mailFailed'
}

// Each email on its own, so one bad address doesn't stop the rest. In order,
// over one connection.
export async function sendEmails(
  server: MailServer,
  emails: OutgoingEmail[],
): Promise<SendResult[]> {
  const transport = createTransport(server, emails.length > 1)
  // Never nameless, which inboxes would show as the bare address
  const from = {
    name: server.fromName.trim() || APP_NAME,
    address: server.fromAddress,
  }
  const results: SendResult[] = []

  try {
    for (const email of emails) {
      try {
        await transport.sendMail({ from, ...email })
        results.push({ status: 'sent' })
      } catch (error) {
        console.error(`[EMAIL] - Unable to send an email!`, error)
        results.push({ status: 'failed', error: getMailErrorKey(error) })
      }
    }
  } finally {
    transport.close()
  }

  return results
}

export async function sendEmail(
  server: MailServer,
  email: OutgoingEmail,
): Promise<SendResult> {
  const [result] = await sendEmails(server, [email])

  return result
}

// The saved password never goes back to the browser, like the API keys
export function maskMailPassword<T extends Partial<MailServer>>(
  server: T,
  stored: Partial<MailServer> = server,
): T {
  return server.smtpPassword && server.smtpPassword === stored.smtpPassword
    ? { ...server, smtpPassword: SAVED_API_KEY }
    : server
}

// The saved password is only reused for the server and user it was saved for,
// so changing them can't send it elsewhere. Null when it has to be typed again.
export function restoreMailPassword<T extends MailServer>(
  submitted: T,
  saved: MailServer,
): T | null {
  if (submitted.smtpPassword !== SAVED_API_KEY) {
    return submitted
  }

  if (
    !saved.smtpPassword ||
    submitted.smtpHost !== saved.smtpHost ||
    submitted.smtpUser !== saved.smtpUser
  ) {
    return null
  }

  return { ...submitted, smtpPassword: saved.smtpPassword }
}
