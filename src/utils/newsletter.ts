import fs from 'fs/promises'
import path from 'path'
import { SendError, sendNewsletter } from './emailSend'
import { getErrorCode, replaceFile } from './files'
import getSettings from './getSettings'
import { isMailServerSet } from './mailer'
import {
  getDueSendTime,
  getLatestSendTime,
  getNewsletterPeriod,
  NewsletterSchedule,
} from './newsletterSchedule'
import { checkRewindRelease } from './rewindRelease'

export const NEWSLETTER_STATE_PATH = path.join(
  process.cwd(),
  'config/newsletter.json',
)

export type NewsletterRun = {
  // ISO 8601, when it went out
  at: string
  sent: number
  failed: number
  skipped: number
  // Set when nothing could be sent
  error?: SendError
}

type NewsletterState = {
  // ISO 8601, the last send time that went out, or that was passed over
  // because the newsletter was turned on or moved after it
  handledUntil: string | null
  lastRun: NewsletterRun | null
}

const EMPTY_STATE: NewsletterState = { handledUntil: null, lastRun: null }
// How often the schedules are looked at. A newsletter or the Rewind invites
// go out within this long of their hour.
const CHECK_INTERVAL_MS = 5 * 60 * 1000
// After a start, so the history read gets a head start
const FIRST_CHECK_MS = 60 * 1000

export async function readNewsletterState(): Promise<NewsletterState> {
  try {
    const saved = JSON.parse(await fs.readFile(NEWSLETTER_STATE_PATH, 'utf-8'))

    return { ...EMPTY_STATE, ...saved }
  } catch (error) {
    if (getErrorCode(error) !== 'ENOENT') {
      console.error(
        '[NEWSLETTER] - Unable to read the newsletter state!',
        error,
      )
    }

    return EMPTY_STATE
  }
}

async function writeNewsletterState(state: NewsletterState): Promise<void> {
  await replaceFile(
    NEWSLETTER_STATE_PATH,
    `${JSON.stringify(state, undefined, 2)}\n`,
  )
}

// A newsletter that was due before it was turned on or moved isn't sent
// late, so the first one goes out at the next send time
export async function passOverDueNewsletter(
  schedule: NewsletterSchedule,
  now: Date = new Date(),
): Promise<void> {
  const state = await readNewsletterState()

  await writeNewsletterState({
    ...state,
    handledUntil: getLatestSendTime(schedule, now).toISOString(),
  })
}

type SchedulerState = {
  timer: ReturnType<typeof setInterval> | null
  isRunning: boolean
}

// Kept across reloads in development, so they don't start a second timer
const globalForNewsletter = globalThis as typeof globalThis & {
  rewindarrNewsletter?: SchedulerState
}

export async function checkNewsletter(now: Date = new Date()): Promise<void> {
  const scheduler = globalForNewsletter.rewindarrNewsletter

  if (scheduler?.isRunning) {
    return
  }

  const settings = getSettings()

  if (
    !settings.setupComplete ||
    !settings.email.isNewsletterActive ||
    !isMailServerSet(settings.email)
  ) {
    return
  }

  const state = await readNewsletterState()
  const sendTime = getDueSendTime(
    settings.email,
    state.handledUntil ? new Date(state.handledUntil) : null,
    now,
  )

  if (!sendTime) {
    return
  }

  if (scheduler) {
    scheduler.isRunning = true
  }

  try {
    const report = await sendNewsletter(
      settings,
      getNewsletterPeriod(settings.email, sendTime),
    )

    // Nothing went out, so it's tried again at the next check, until it's
    // too late. While the history is read, that's expected.
    if (report.status === 'error') {
      if (report.error !== 'historyReading') {
        console.error(
          `[NEWSLETTER] - Unable to send the newsletter (${report.error}), trying again later.`,
        )
        await writeNewsletterState({
          ...state,
          lastRun: {
            at: new Date().toISOString(),
            sent: 0,
            failed: 0,
            skipped: 0,
            error: report.error,
          },
        })
      }

      return
    }

    const count = (status: string) =>
      report.outcomes.filter((outcome) => outcome.status === status).length
    const lastRun: NewsletterRun = {
      at: new Date().toISOString(),
      sent: count('sent'),
      failed: count('failed'),
      skipped: count('skipped'),
    }
    // When none went out because the mail server couldn't be reached, it's
    // tried again at the next check. Nobody got it yet, so nobody gets it
    // twice. A wrong password or a rejected address isn't, as trying again
    // wouldn't change it.
    const failures = report.outcomes.filter(
      (outcome) => outcome.status === 'failed',
    )

    if (
      !lastRun.sent &&
      failures.length &&
      failures.every((outcome) => outcome.reason === 'mailUnableToConnect')
    ) {
      console.error(
        `[NEWSLETTER] - Unable to send any of ${lastRun.failed}, trying again later.`,
      )
      await writeNewsletterState({ ...state, lastRun })

      return
    }

    console.log(
      `[NEWSLETTER] - Sent ${lastRun.sent}, failed ${lastRun.failed}, skipped ${lastRun.skipped}.`,
    )
    await writeNewsletterState({
      handledUntil: sendTime.toISOString(),
      lastRun,
    })
  } catch (error) {
    console.error('[NEWSLETTER] - Unable to send the newsletter!', error)
  } finally {
    if (scheduler) {
      scheduler.isRunning = false
    }
  }
}

function check() {
  checkNewsletter().catch((error) => {
    console.error('[NEWSLETTER] - Unable to check the schedule!', error)
  })
  checkRewindRelease().catch((error) => {
    console.error('[REWIND EMAILS] - Unable to check the release!', error)
  })
}

// The newsletter's, and the Rewind invites on the release day
export function startEmailSchedule(): void {
  if (globalForNewsletter.rewindarrNewsletter?.timer) {
    return
  }

  const timer = setInterval(check, CHECK_INTERVAL_MS)

  // Doesn't keep the process alive on its own
  timer.unref()
  setTimeout(check, FIRST_CHECK_MS).unref()
  globalForNewsletter.rewindarrNewsletter = { timer, isRunning: false }
}
