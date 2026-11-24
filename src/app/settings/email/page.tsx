import { requireSettingsAccess } from '@/lib/access'
import { authOptions } from '@/lib/auth'
import { getSiteUrl } from '@/utils/constants'
import { canShowOthers } from '@/utils/emailContent'
import { EmailRecipient, getEmailRecipients } from '@/utils/emailRecipients'
import getSettings from '@/utils/getSettings'
import { maskMailPassword } from '@/utils/mailer'
import { readNewsletterState } from '@/utils/newsletter'
import { getNextSendTime } from '@/utils/newsletterSchedule'
import { canShareRewind } from '@/utils/rewindShare'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import EmailSettingsForm from './_components/EmailSettingsForm'

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

export default async function EmailSettingsPage() {
  await requireSettingsAccess()

  const settings = getSettings()
  const session = await getServerSession(authOptions)
  const { lastRun } = await readNewsletterState()
  const {
    addresses: _addresses,
    unsubscribed: _unsubscribed,
    ...email
  } = maskMailPassword(settings.email)

  return (
    <EmailSettingsForm
      settings={email}
      // Not waited for, so the form shows while they're read
      recipients={readRecipients()}
      siteUrl={getSiteUrl() ?? ''}
      isRewindShared={canShareRewind(settings)}
      isOthersShown={canShowOthers(settings)}
      nextSendTime={getNextSendTime(settings.email, new Date()).toISOString()}
      lastRun={lastRun}
      adminAddress={session?.user.email ?? ''}
      adminId={session?.user.id ?? ''}
      timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
    />
  )
}
