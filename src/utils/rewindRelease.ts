import fs from 'fs/promises'
import path from 'path'
import { getEmailRecipients } from './emailRecipients'
import { SendError, sendRewindEmails } from './emailSend'
import { getErrorCode, replaceFile } from './files'
import getSettings from './getSettings'
import { isMailServerSet } from './mailer'
import {
  getDueReleaseYear,
  getLatestReleaseYear,
  isReleaseEmailOn,
  ReleaseSettings,
} from './rewindReleaseSchedule'

export const REWIND_EMAILS_STATE_PATH = path.join(
  process.cwd(),
  'config/rewind-emails.json',
)

export type RewindEmailsRun = {
  // ISO 8601, when it went out
  at: string
  year: number
  sent: number
  failed: number
  skipped: number
  // Set when nothing could be sent
  error?: SendError
}

type RewindEmailsState = {
  // The last edition whose invites went out, or were passed over because the
  // emails were turned on after it came out
  handledYear: number | null
  lastRun: RewindEmailsRun | null
}

const EMPTY_STATE: RewindEmailsState = { handledYear: null, lastRun: null }

export async function readRewindEmailsState(): Promise<RewindEmailsState> {
  try {
    const saved = JSON.parse(
      await fs.readFile(REWIND_EMAILS_STATE_PATH, 'utf-8'),
    )

    return { ...EMPTY_STATE, ...saved }
  } catch (error) {
    if (getErrorCode(error) !== 'ENOENT') {
      console.error(
        '[REWIND EMAILS] - Unable to read the Rewind emails state!',
        error,
      )
    }

    return EMPTY_STATE
  }
}

// The later of two handled editions, so a save or a slow run never makes an
// edition that went out due again
function laterYear(a: number | null, b: number | null): number | null {
  return a === null ? b : b === null ? a : Math.max(a, b)
}

async function writeRewindEmailsState(state: RewindEmailsState) {
  await replaceFile(
    REWIND_EMAILS_STATE_PATH,
    `${JSON.stringify(state, undefined, 2)}\n`,
  )
}

// An edition that came out before they were turned on isn't sent late, so the
// first invites go out with the next one
export async function passOverReleasedRewind(
  settings: ReleaseSettings,
  now: Date = new Date(),
): Promise<void> {
  const state = await readRewindEmailsState()

  await writeRewindEmailsState({
    ...state,
    handledYear: laterYear(
      state.handledYear,
      getLatestReleaseYear(settings, now),
    ),
  })
}

const globalForRewindEmails = globalThis as typeof globalThis & {
  rewindarrRewindEmails?: { isRunning: boolean }
}

export async function checkRewindRelease(now: Date = new Date()) {
  const settings = getSettings()

  if (
    !settings.setupComplete ||
    !isReleaseEmailOn(settings) ||
    !isMailServerSet(settings.email)
  ) {
    return
  }

  const state = await readRewindEmailsState()
  const year = getDueReleaseYear(settings, state.handledYear, now)
  const lock = (globalForRewindEmails.rewindarrRewindEmails ??= {
    isRunning: false,
  })

  if (year === null || lock.isRunning) {
    return
  }

  lock.isRunning = true

  try {
    const recipients = await getEmailRecipients(settings)
    const report = await sendRewindEmails(
      settings,
      recipients
        .filter(({ address, isInvited }) => address && isInvited)
        .map(({ id }) => id),
    )

    // Nothing went out, so it's tried again at the next check while the
    // edition is new. While the history is read, that's expected.
    if (report.status === 'error') {
      if (report.error !== 'historyReading') {
        console.error(
          `[REWIND EMAILS] - Unable to send the invites (${report.error}), trying again later.`,
        )
        // Read again, as a save can pass the edition over while it ran
        await writeRewindEmailsState({
          ...(await readRewindEmailsState()),
          lastRun: {
            at: new Date().toISOString(),
            year,
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
    const lastRun: RewindEmailsRun = {
      at: new Date().toISOString(),
      year,
      sent: count('sent'),
      failed: count('failed'),
      skipped: count('skipped'),
    }
    const failures = report.outcomes.filter(
      (outcome) => outcome.status === 'failed',
    )

    // As with the newsletter, an unreachable mail server is tried again, as
    // nobody got one yet
    if (
      !lastRun.sent &&
      failures.length &&
      failures.every((outcome) => outcome.reason === 'mailUnableToConnect')
    ) {
      console.error(
        `[REWIND EMAILS] - Unable to send any of ${lastRun.failed}, trying again later.`,
      )
      await writeRewindEmailsState({
        ...(await readRewindEmailsState()),
        lastRun,
      })

      return
    }

    console.log(
      `[REWIND EMAILS] - Sent ${lastRun.sent}, failed ${lastRun.failed}, skipped ${lastRun.skipped}.`,
    )

    const latest = await readRewindEmailsState()

    await writeRewindEmailsState({
      handledYear: laterYear(latest.handledYear, year),
      lastRun,
    })
  } catch (error) {
    console.error('[REWIND EMAILS] - Unable to send the invites!', error)
  } finally {
    lock.isRunning = false
  }
}
