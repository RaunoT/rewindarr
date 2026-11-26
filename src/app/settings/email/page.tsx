import { requireSettingsAccess } from '@/lib/access'
import { authOptions } from '@/lib/auth'
import { getSiteUrl } from '@/utils/constants'
import { canShowOthers } from '@/utils/emailContent'
import { EmailRecipient, getEmailRecipients } from '@/utils/emailRecipients'
import getSettings from '@/utils/getSettings'
import { isMailServerSet, maskMailPassword } from '@/utils/mailer'
import { readNewsletterState } from '@/utils/newsletter'
import { readRewindEmailsState } from '@/utils/rewindRelease'
import {
  canSendReleaseEmails,
  getLatestReleaseYear,
  getNextReleaseEmailTime,
} from '@/utils/rewindReleaseSchedule'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import EmailSettingsForm, {
  InviteStatus,
} from './_components/EmailSettingsForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Settings.Email')

  return {
    title: t('title'),
  }
}

async function readRecipients(): Promise<EmailRecipient[] | null> {
  try {
    return await getEmailRecipients(getSettings())
  } catch (error) {
    console.error('[EMAIL] - Error reading the users to email!', error)

    return null
  }
}

async function getInviteStatus(): Promise<InviteStatus> {
  const settings = getSettings()
  const { handledYear, lastRun } = await readRewindEmailsState()
  const now = new Date()
  const isActive = settings.rewind.isReleaseEmailActive

  return {
    canInvite: canSendReleaseEmails(settings),
    isActive,
    isMailServerSet: isMailServerSet(settings.email),
    // While they're off, as turning them on would make it: an edition that's
    // already out is passed over
    nextTime: getNextReleaseEmailTime(
      settings,
      isActive ? handledYear : getLatestReleaseYear(settings, now),
      now,
    ).toISOString(),
    lastRun,
  }
}

export default async function EmailSettingsPage() {
  await requireSettingsAccess('email')

  const settings = getSettings()
  const session = await getServerSession(authOptions)
  const { lastRun } = await readNewsletterState()
  const {
    addresses: _addresses,
    unsubscribed: _unsubscribed,
    inviteUnsubscribed: _inviteUnsubscribed,
    ...email
  } = maskMailPassword(settings.email)

  return (
    <EmailSettingsForm
      settings={email}
      // Not waited for, so the form shows while they're read
      recipients={readRecipients()}
      siteUrl={getSiteUrl() ?? ''}
      isOthersShown={canShowOthers(settings)}
      invite={await getInviteStatus()}
      lastRun={lastRun}
      adminAddress={session?.user.email ?? ''}
      adminId={session?.user.id ?? ''}
      timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
      now={new Date().toISOString()}
    />
  )
}
