import { Settings } from '@/types/settings'
import { APP_NAME } from '@/utils/constants'
import {
  EmailBlock,
  panel,
  renderBlocks,
  renderLayout,
} from '@/utils/emailHtml'
import { getEmailIntl } from '@/utils/emailIntl'
import { getAppUrl, isUnsubscribeKey, toAppUrl } from '@/utils/emailLinks'
import getSettings, { writeSettings } from '@/utils/getSettings'

export const dynamic = 'force-dynamic'

type Page = 'confirm' | 'done' | 'invalid'

// A page in the emails' look, as the reader comes from one
async function renderPage(
  settings: Settings,
  page: Page,
  action?: string,
): Promise<Response> {
  const { t, locale } = await getEmailIntl(settings.email.locale)
  const appUrl = getAppUrl(settings)
  const serverName = settings.general.serverName || APP_NAME
  const blocks: EmailBlock[] = [
    { type: 'eyebrow', text: t('Email.Unsubscribe.eyebrow') },
    { type: 'title', text: t(`Email.Unsubscribe.${page}.title`) },
    {
      type: 'paragraph',
      text: t(`Email.Unsubscribe.${page}.body`, { server: serverName }),
    },
  ]

  if (page === 'confirm' && action) {
    blocks.push({
      type: 'form',
      action,
      label: t('Email.Unsubscribe.button'),
    })
  }

  return new Response(
    renderLayout({
      locale,
      title: t(`Email.Unsubscribe.${page}.title`),
      preheader: '',
      serverName,
      logoUrl: appUrl && toAppUrl(appUrl, '/icon-192x192.png'),
      content: panel(renderBlocks(blocks)),
    }),
    {
      status: page === 'invalid' ? 404 : 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // The key is in the address
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'no-store',
      },
    },
  )
}

function readKey(request: Request) {
  const { searchParams } = new URL(request.url)

  return { userId: searchParams.get('userId'), key: searchParams.get('key') }
}

// Opening the link only asks, as mail scanners open links too
export async function GET(request: Request) {
  const settings = getSettings()
  const { userId, key } = readKey(request)

  if (!isUnsubscribeKey(userId, key)) {
    return renderPage(settings, 'invalid')
  }

  const url = new URL(request.url)

  return renderPage(settings, 'confirm', `${url.pathname}${url.search}`)
}

// From the page's button, and from mail apps' own unsubscribe buttons
export async function POST(request: Request) {
  const settings = getSettings()
  const { userId, key } = readKey(request)

  if (!userId || !isUnsubscribeKey(userId, key)) {
    return renderPage(settings, 'invalid')
  }

  try {
    if (!settings.email.unsubscribed.includes(userId)) {
      settings.email.unsubscribed.push(userId)
      writeSettings(settings)
    }
  } catch (error) {
    console.error('[EMAIL] - Unable to unsubscribe a user!', error)

    return new Response(null, { status: 500 })
  }

  return renderPage(settings, 'done')
}
