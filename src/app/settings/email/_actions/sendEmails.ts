'use server'

import { canManageSettings } from '@/lib/access'
import { authOptions } from '@/lib/auth'
import { buildTestEmail } from '@/utils/emailContent'
import { getEmailIntl } from '@/utils/emailIntl'
import { getAppUrl } from '@/utils/emailLinks'
import { isEmailAddress } from '@/utils/emailRecipients'
import {
  SendOutcome,
  SendReport,
  sendNewsletter,
  sendRewindEmails,
} from '@/utils/emailSend'
import getSettings from '@/utils/getSettings'
import { isMailServerSet, restoreMailPassword, sendEmail } from '@/utils/mailer'
import {
  getLatestSendTime,
  getNewsletterPeriod,
} from '@/utils/newsletterSchedule'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { readMailServerForm } from './emailForm'

export type SendActionResult = {
  status: 'success' | 'error'
  message: string
  outcomes?: SendOutcome[]
}

async function deny(): Promise<SendActionResult> {
  const t = await getTranslations('Settings')

  return { status: 'error', message: t('genericError') }
}

// Sent with what's in the form, before it's saved, like the connection tests
export async function sendTestEmail(
  fields: [string, string][],
  to: string,
): Promise<SendActionResult> {
  if (!(await canManageSettings())) {
    return deny()
  }

  const t = await getTranslations('Settings.Email')
  const formData = new FormData()

  for (const [name, value] of fields) {
    formData.append(name, value)
  }

  const settings = getSettings()
  const server = restoreMailPassword(
    readMailServerForm(formData),
    settings.email,
  )

  if (!server) {
    return { status: 'error', message: t('reenterPassword') }
  }

  if (!isMailServerSet(server)) {
    return { status: 'error', message: t('mailServerMissing') }
  }

  if (!isEmailAddress(to)) {
    return { status: 'error', message: t('addressError') }
  }

  const intl = await getEmailIntl(settings.email.locale)
  const result = await sendEmail(
    server,
    buildTestEmail(settings, intl, to, getAppUrl(settings)),
  )

  return result.status === 'sent'
    ? { status: 'success', message: t('testSent', { address: to }) }
    : { status: 'error', message: t(result.error) }
}

async function toResult(report: SendReport): Promise<SendActionResult> {
  const t = await getTranslations('Settings.Email')

  if (report.status === 'error') {
    return { status: 'error', message: t(report.error) }
  }

  const count = (status: SendOutcome['status']) =>
    report.outcomes.filter((outcome) => outcome.status === status).length
  const sent = count('sent')
  const failed = count('failed')
  const skipped = count('skipped')

  return {
    status: failed || !sent ? 'error' : 'success',
    message: t('sendSummary', { sent, failed, skipped }),
    outcomes: report.outcomes,
  }
}

export async function sendRewind(userIds: string[]): Promise<SendActionResult> {
  if (!(await canManageSettings())) {
    return deny()
  }

  return toResult(await sendRewindEmails(getSettings(), userIds))
}

// The signed-in admin's own newsletter for the last period, sent to them
export async function sendNewsletterToMe(): Promise<SendActionResult> {
  if (!(await canManageSettings())) {
    return deny()
  }

  const session = await getServerSession(authOptions)
  const settings = getSettings()

  if (!session?.user.id) {
    return deny()
  }

  const period = getNewsletterPeriod(
    settings.email,
    getLatestSendTime(settings.email, new Date()),
  )

  return toResult(
    await sendNewsletter(settings, period, {
      userIds: [session.user.id],
      // The one they signed in with, where there's no other
      fallbackAddress: session.user.email ?? undefined,
    }),
  )
}
