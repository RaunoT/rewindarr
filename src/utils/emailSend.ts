import { Settings } from '@/types/settings'
import { Library, PlayPeriod } from '@/types/statsSource'
import {
  BuiltEmail,
  buildNewsletter,
  buildRewindEmail,
  getServerRecap,
  SkipReason,
} from './emailContent'
import { getEmailIntl } from './emailIntl'
import { getAppUrl } from './emailLinks'
import { EmailRecipient, getEmailRecipients } from './emailRecipients'
import { isMailServerSet, MailErrorKey, sendEmails } from './mailer'
import { getRewindPeriod } from './rewindPeriod'
import { canShareRewind } from './rewindShare'
import { getHistoryProgress, getLibraries } from './statsSource'

// What happened to each user's email
export type SendOutcome = {
  userId: string
  name: string
  status: 'sent' | 'failed' | 'skipped'
  reason?: MailErrorKey | SkipReason
}

// Why nothing could be sent, as a key of the Settings.Email messages
export type SendError =
  | 'mailServerMissing'
  | 'appUrlMissing'
  | 'rewindNotShared'
  | 'historyReading'
  | 'sendFailed'

export type SendReport =
  | { status: 'done'; outcomes: SendOutcome[] }
  | { status: 'error'; error: SendError }

// How long a send waits for the play history to be read before giving up
const HISTORY_TIMEOUT_MS = 30_000

type Context = {
  appUrl: string
  libraries: Library[]
}

async function prepare(
  settings: Settings,
  since: string,
): Promise<Context | SendError> {
  if (!isMailServerSet(settings.email)) {
    return 'mailServerMissing'
  }

  const appUrl = getAppUrl(settings)

  if (!appUrl) {
    return 'appUrlMissing'
  }

  const libraries = await getLibraries()

  if (await getHistoryProgress(since, libraries, HISTORY_TIMEOUT_MS)) {
    return 'historyReading'
  }

  return { appUrl, libraries }
}

// Builds each user's email in turn, as each reads their plays, then sends the
// ready ones over one connection
async function buildAndSend(
  settings: Settings,
  recipients: EmailRecipient[],
  build: (recipient: EmailRecipient) => Promise<BuiltEmail>,
): Promise<SendOutcome[]> {
  const built: { recipient: EmailRecipient; result: BuiltEmail }[] = []

  for (const recipient of recipients) {
    built.push({ recipient, result: await build(recipient) })
  }

  const ready = built.flatMap(({ result }) =>
    result.status === 'ready' ? [result.email] : [],
  )
  const results = ready.length ? await sendEmails(settings.email, ready) : []

  let sentIndex = 0

  return built.map(({ recipient, result }) => {
    const base = { userId: recipient.id, name: recipient.name }

    if (result.status === 'skipped') {
      return { ...base, status: 'skipped', reason: result.reason }
    }

    const sent = results[sentIndex++]

    return sent.status === 'sent'
      ? { ...base, status: 'sent' }
      : { ...base, status: 'failed', reason: sent.error }
  })
}

async function run(
  since: string,
  settings: Settings,
  send: (context: Context) => Promise<SendOutcome[]>,
): Promise<SendReport> {
  try {
    const context = await prepare(settings, since)

    if (typeof context === 'string') {
      return { status: 'error', error: context }
    }

    return { status: 'done', outcomes: await send(context) }
  } catch (error) {
    console.error('[EMAIL] - Unable to send the emails!', error)

    return { status: 'error', error: 'sendFailed' }
  }
}

// Picks the users asked for, in that order. `fallbackAddress` stands in for
// a user's address where there's none.
export function pickRecipients(
  recipients: EmailRecipient[],
  userIds: string[],
  fallbackAddress?: string,
): EmailRecipient[] {
  return userIds.flatMap((userId) => {
    const recipient = recipients.find(({ id }) => id === userId)

    if (!recipient) {
      return []
    }

    return [
      {
        ...recipient,
        address: recipient.address || fallbackAddress || '',
      },
    ]
  })
}

// Each of the users asked for a link to their Rewind
export async function sendRewindEmails(
  settings: Settings,
  userIds: string[],
): Promise<SendReport> {
  if (!canShareRewind(settings)) {
    return { status: 'error', error: 'rewindNotShared' }
  }

  const intl = await getEmailIntl(settings.email.locale)
  const period = getRewindPeriod(settings, { timeZone: intl.timeZone })

  return run(period.since, settings, async ({ appUrl, libraries }) => {
    const recipients = pickRecipients(
      await getEmailRecipients(settings),
      userIds,
    )

    return buildAndSend(settings, recipients, (recipient) =>
      buildRewindEmail(settings, intl, recipient, appUrl, libraries),
    )
  })
}

// To everyone subscribed with an address, or to the users asked for
export async function sendNewsletter(
  settings: Settings,
  period: PlayPeriod,
  only?: { userIds: string[]; fallbackAddress?: string },
): Promise<SendReport> {
  const intl = await getEmailIntl(settings.email.locale)

  return run(period.since, settings, async ({ appUrl, libraries }) => {
    const allRecipients = await getEmailRecipients(settings)
    const recipients = only
      ? pickRecipients(allRecipients, only.userIds, only.fallbackAddress)
      : allRecipients.filter(
          (recipient) => recipient.address && recipient.isSubscribed,
        )
    const server = await getServerRecap(settings, libraries, period)

    return buildAndSend(settings, recipients, (recipient) =>
      buildNewsletter(
        settings,
        intl,
        recipient,
        appUrl,
        libraries,
        period,
        server,
      ),
    )
  })
}
