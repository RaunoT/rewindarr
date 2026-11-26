import { canManageEmail } from '@/lib/access'
import { authOptions } from '@/lib/auth'
import {
  buildNewsletter,
  buildRewindEmail,
  getServerRecap,
} from '@/utils/emailContent'
import { getEmailIntl } from '@/utils/emailIntl'
import { getAppUrl } from '@/utils/emailLinks'
import { getEmailRecipients } from '@/utils/emailRecipients'
import getSettings from '@/utils/getSettings'
import {
  getLatestSendTime,
  getNewsletterPeriod,
} from '@/utils/newsletterSchedule'
import { getRewindPeriod } from '@/utils/rewindPeriod'
import { canShareRewind } from '@/utils/rewindShare'
import { getHistoryProgress, getLibraries } from '@/utils/statsSource'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

function text(message: string, status = 200): Response {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

// Shows an email as a user would get it, without sending it. Their own stats
// are in it, so only admins can open it.
export async function GET(request: Request) {
  if (!(await canManageEmail())) {
    return new Response(null, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const session = await getServerSession(authOptions)
  const userId = searchParams.get('userId') || session?.user.id

  if ((type !== 'newsletter' && type !== 'rewind') || !userId) {
    return new Response(null, { status: 400 })
  }

  const settings = getSettings()
  const t = await getTranslations('Settings.Email')
  const appUrl = getAppUrl(settings) ?? new URL(request.url).origin
  const intl = await getEmailIntl(settings.email.locale)
  const recipient = (await getEmailRecipients(settings)).find(
    (user) => user.id === userId,
  )

  if (!recipient) {
    return text(t('previewNoUser'), 404)
  }

  // A preview goes nowhere, so it doesn't need an address
  const reader = { ...recipient, address: recipient.address || '-' }
  // As the emails are sent
  const libraries = await getLibraries(true, { isAll: true })
  const period =
    type === 'rewind'
      ? getRewindPeriod(settings, { timeZone: intl.timeZone })
      : getNewsletterPeriod(
          settings.email,
          getLatestSendTime(settings.email, new Date()),
        )

  if (type === 'rewind' && !canShareRewind(settings)) {
    return text(t('rewindNotShared'), 409)
  }

  if (await getHistoryProgress(period.since, libraries)) {
    return text(t('historyReading'), 503)
  }

  const built =
    type === 'rewind'
      ? await buildRewindEmail(settings, intl, reader, appUrl, libraries)
      : await buildNewsletter(
          settings,
          intl,
          reader,
          appUrl,
          libraries,
          period,
          await getServerRecap(settings, libraries, period),
        )

  if (built.status === 'skipped') {
    return text(t(`skipReasons.${built.reason}`))
  }

  return new Response(built.email.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
