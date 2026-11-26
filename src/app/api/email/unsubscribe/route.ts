import { Settings } from '@/types/settings'
import { APP_NAME } from '@/utils/constants'
import {
  EmailBlock,
  panel,
  renderBlocks,
  renderLayout,
} from '@/utils/emailHtml'
import { getEmailIntl } from '@/utils/emailIntl'
import {
  EmailList,
  getAppUrl,
  isUnsubscribeKey,
  readEmailList,
  toAppUrl,
} from '@/utils/emailLinks'
import getSettings, { writeSettings } from '@/utils/getSettings'

export const dynamic = 'force-dynamic'

type Page = 'confirm' | 'done' | 'invalid'

// Where each list's unsubscribed users are kept
const LIST_FIELDS = {
  newsletter: 'unsubscribed',
  invite: 'inviteUnsubscribed',
} as const satisfies Record<EmailList, keyof Settings['email']>

// A page in the emails' look, as the reader comes from one
async function renderPage(
  settings: Settings,
  page: Page,
  list: EmailList,
  action?: string,
): Promise<Response> {
  const { t, locale } = await getEmailIntl(settings.email.locale)
  const appUrl = getAppUrl(settings)
  const serverName = settings.general.serverName || APP_NAME
  // A broken link has nothing to do with the list
  const title =
    page === 'invalid'
      ? t('Email.Unsubscribe.invalid.title')
      : t(`Email.Unsubscribe.${list}.${page}.title`)
  const body =
    page === 'invalid'
      ? t('Email.Unsubscribe.invalid.body', { server: serverName })
      : t(`Email.Unsubscribe.${list}.${page}.body`, { server: serverName })
  const blocks: EmailBlock[] = [
    { type: 'eyebrow', text: t(`Email.Unsubscribe.${list}.eyebrow`) },
    { type: 'title', text: title },
    { type: 'paragraph', text: body },
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
      title,
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

  return {
    userId: searchParams.get('userId'),
    key: searchParams.get('key'),
    list: readEmailList(searchParams),
  }
}

// Opening the link only asks, as mail scanners open links too
export async function GET(request: Request) {
  const settings = getSettings()
  const { userId, key, list } = readKey(request)

  if (!list || !isUnsubscribeKey(userId, key, list)) {
    return renderPage(settings, 'invalid', list ?? 'newsletter')
  }

  const url = new URL(request.url)

  return renderPage(settings, 'confirm', list, `${url.pathname}${url.search}`)
}

// From the page's button, and from mail apps' own unsubscribe buttons
export async function POST(request: Request) {
  const settings = getSettings()
  const { userId, key, list } = readKey(request)

  if (!list || !userId || !isUnsubscribeKey(userId, key, list)) {
    return renderPage(settings, 'invalid', list ?? 'newsletter')
  }

  const unsubscribed = settings.email[LIST_FIELDS[list]]

  try {
    if (!unsubscribed.includes(userId)) {
      unsubscribed.push(userId)
      writeSettings(settings)
    }
  } catch (error) {
    console.error('[EMAIL] - Unable to unsubscribe a user!', error)

    return new Response(null, { status: 500 })
  }

  return renderPage(settings, 'done', list)
}
