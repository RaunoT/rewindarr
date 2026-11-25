import { Settings } from '@/types/settings'
import {
  ItemRow,
  Library,
  MediaStats,
  PlayPeriod,
  TopMediaItems,
} from '@/types/statsSource'
import { APP_NAME } from './constants'
import { EmailBlock, ListItem, renderEmail } from './emailHtml'
import { EmailIntl } from './emailIntl'
import { getRewindShareUrl, getUnsubscribeUrl, toAppUrl } from './emailLinks'
import { EmailRecipient } from './emailRecipients'
import { getInitials, secondsToTime } from './formatting'
import { OutgoingEmail } from './mailer'
import { getRewindPeriod } from './rewindPeriod'
import { getStatsSource } from './statsSource'

// Why a user got no email, as a key of the Settings.Email messages
export type SkipReason = 'noAddress' | 'noPlays' | 'nothingToShow'

export type BuiltEmail =
  | { status: 'ready'; email: OutgoingEmail }
  | { status: 'skipped'; reason: SkipReason }

const LIST_LENGTH = 3
const SERVER_LIST_LENGTH = 5
const RANKS_LENGTH = 5
// From the project's site, not the app: mail apps load images through their
// own servers, which can't reach an app that's only open at home or on a VPN
const LOGO_URL = 'https://rewindarr.eu/assets/apple-icon.png'

function getBranding(settings: Settings) {
  return {
    serverName: settings.general.serverName || APP_NAME,
    logoUrl: LOGO_URL,
  }
}

function getTotals(stats: MediaStats) {
  const types = Object.values(stats)

  return {
    plays: types.reduce((sum, { count }) => sum + count, 0),
    duration: types.reduce((sum, { duration }) => sum + (duration ?? 0), 0),
  }
}

// Mail apps can't sign in to the media server, so only TMDB's posters show
function toListItem(item: ItemRow, intl: EmailIntl): ListItem {
  const { t } = intl

  return {
    title: item.title,
    // The count only says something from 2 plays up. Under the play
    // threshold, a partial watch adds time without a play.
    meta: [
      item.total_plays > 1 && t('Email.plays', { count: item.total_plays }),
      secondsToTime(item.total_duration, t),
    ]
      .filter(Boolean)
      .join(' · '),
    imageUrl: item.tmdb_poster || null,
  }
}

// The lists with anything in them, two to a row
function getItemColumns(
  lists: { heading: string; items: ItemRow[] }[],
  intl: EmailIntl,
): EmailBlock[] {
  const blocks = lists
    .filter(({ items }) => items.length)
    .map(({ heading, items }): EmailBlock[] => [
      { type: 'heading', text: heading },
      {
        type: 'items',
        items: items.map((item) => toListItem(item, intl)),
      },
    ])
  const rows: EmailBlock[] = []

  for (let i = 0; i < blocks.length; i += 2) {
    // One left over takes the whole width
    if (blocks[i + 1]) {
      rows.push({ type: 'columns', left: blocks[i], right: blocks[i + 1] })
    } else {
      rows.push(...blocks[i])
    }
  }

  return rows
}

function formatDuration(seconds: number, intl: EmailIntl): string {
  return secondsToTime(seconds, intl.t)
}

// What the Rewind has in store, without giving any of it away. Stories the
// admin hid aren't promised.
const REWIND_TEASERS = [
  { story: 'total', key: 'watchTime' },
  { story: 'shows_top', key: 'topShow' },
  { story: 'personality', key: 'personality' },
] as const

function getRewindTeaser(settings: Settings, intl: EmailIntl): EmailBlock[] {
  const tiles = REWIND_TEASERS.filter(
    ({ story }) => !settings.rewind.hiddenStories.includes(story),
  ).map(({ key }) => ({
    label: intl.t(`Email.Rewind.teaser.${key}`),
    value: '?',
  }))

  return tiles.length ? [{ type: 'tiles', tiles }] : []
}

// An invitation to the reader's Rewind, from its latest edition
export async function buildRewindEmail(
  settings: Settings,
  intl: EmailIntl,
  recipient: EmailRecipient,
  appUrl: string,
  libraries: Library[],
): Promise<BuiltEmail> {
  if (!recipient.address) {
    return { status: 'skipped', reason: 'noAddress' }
  }

  const { t } = intl
  const shareUrl = getRewindShareUrl(settings, appUrl, recipient.id)

  if (!shareUrl) {
    throw new Error('Rewind can not be shared')
  }

  const period = getRewindPeriod(settings, { timeZone: intl.timeZone })
  const stats = await getStatsSource(settings).getMediaStats(
    recipient.id,
    libraries,
    period,
  )

  // Only whether they played anything, as the Rewind itself is the reveal
  if (!getTotals(stats).plays) {
    return { status: 'skipped', reason: 'noPlays' }
  }

  const { serverName, logoUrl } = getBranding(settings)
  const year = period.year
  const name = recipient.name
  const subject =
    year === null
      ? t('Email.Rewind.subject', { name })
      : t('Email.Rewind.subjectYear', { name, year })
  const { html, text } = renderEmail({
    locale: intl.locale,
    subject,
    preheader: t('Email.Rewind.preheader'),
    serverName,
    logoUrl,
    panels: [
      [
        {
          type: 'eyebrow',
          text:
            year === null
              ? t('Email.Rewind.eyebrow')
              : t('Email.Rewind.eyebrowYear', { year }),
        },
        { type: 'title', text: t('Email.Rewind.title', { name }) },
        { type: 'paragraph', text: t('Email.Rewind.intro') },
        ...getRewindTeaser(settings, intl),
        { type: 'button', href: shareUrl, label: t('Email.Rewind.button') },
      ],
    ],
    footer: t('Email.Rewind.footer'),
  })

  return {
    status: 'ready',
    email: { to: recipient.address, subject, html, text },
  }
}

// What the newsletter shows of the whole server, the same for every reader
export type ServerRecap = {
  stats: MediaStats
  topItems: TopMediaItems
  // By watch time, with their IDs as strings
  users: {
    id: string
    name: string
    duration: number
    // Only a picture mail apps can load, for the ones ranked
    avatarUrl: string | null
  }[]
}

const AVATAR_TIMEOUT_MS = 5000

// Plex's pictures are public, while Jellyfin's and Tracearr's are on servers
// mail apps can't reach. Some Plex ones are gone, which would show broken.
async function getPublicAvatar(url: string | undefined) {
  if (!url?.startsWith('https://plex.tv/')) {
    return null
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(AVATAR_TIMEOUT_MS),
    })

    // Only whether it's there, so the picture itself isn't read
    await response.body?.cancel()

    return response.ok ? url : null
  } catch {
    return null
  }
}

// An empty user ID counts every user's plays
export async function getServerRecap(
  settings: Settings,
  libraries: Library[],
  period: PlayPeriod,
): Promise<ServerRecap> {
  const source = getStatsSource(settings)
  const [stats, topItems, users] = await Promise.all([
    source.getMediaStats('', libraries, period),
    source.getTopMediaItems('', libraries, period),
    source.getTopUsers({ ...period, libraries }),
  ])

  return {
    stats,
    topItems,
    users: await Promise.all(
      (users ?? []).map(async (user, i) => ({
        id: String(user.user_id),
        name: user.friendly_name,
        duration: user.total_duration,
        avatarUrl:
          i < RANKS_LENGTH ? await getPublicAvatar(user.user_thumb) : null,
      })),
    ),
  }
}

// Other users' stats show to users only where the dashboard shows them
export function canShowOthers(settings: Settings): boolean {
  return !settings.dashboard.isOwnOnly
}

export async function buildNewsletter(
  settings: Settings,
  intl: EmailIntl,
  recipient: EmailRecipient,
  appUrl: string,
  libraries: Library[],
  period: PlayPeriod,
  server: ServerRecap,
): Promise<BuiltEmail> {
  if (!recipient.address) {
    return { status: 'skipped', reason: 'noAddress' }
  }

  const { t, format } = intl
  const sections = settings.email.newsletterSections
  const frequency = settings.email.newsletterFrequency
  const isOthersShown = canShowOthers(settings)
  const isServerShown = isOthersShown && sections.includes('server')
  const isRanksShown = isOthersShown && sections.includes('topUsers')
  const serverTotals = getTotals(server.stats)
  const { serverName, logoUrl } = getBranding(settings)
  const panels: EmailBlock[][] = []
  const month = format.dateTime(new Date(period.since), { month: 'long' })
  const range = format.dateTimeRange(
    new Date(period.since),
    // The last day, as the end is the midnight after it
    new Date(new Date(period.until ?? Date.now()).getTime() - 1),
    { day: 'numeric', month: 'short', year: 'numeric' },
  )

  if (!serverTotals.plays) {
    return { status: 'skipped', reason: 'nothingToShow' }
  }

  const intro: EmailBlock[] = [
    {
      type: 'eyebrow',
      text: t(`Email.Newsletter.eyebrow.${frequency}`),
    },
    {
      type: 'title',
      text: t(`Email.Newsletter.title.${frequency}`, {
        name: recipient.name,
        month,
      }),
    },
    { type: 'paragraph', text: range, isMuted: true },
  ]

  if (sections.includes('personal')) {
    const source = getStatsSource(settings)
    const [stats, topItems] = await Promise.all([
      source.getMediaStats(recipient.id, libraries, period),
      source.getTopMediaItems(recipient.id, libraries, period),
    ])
    const totals = getTotals(stats)

    if (!totals.plays && !isServerShown && !isRanksShown) {
      return { status: 'skipped', reason: 'noPlays' }
    }

    panels.push(
      totals.plays
        ? [
            ...intro,
            {
              type: 'tiles',
              tiles: [
                {
                  label: t('Common.duration'),
                  value: formatDuration(totals.duration, intl),
                },
                {
                  label: t('Common.plays'),
                  value: format.number(totals.plays),
                },
              ],
            },
            ...getItemColumns(
              [
                {
                  heading: t('Email.yourTopShows'),
                  items: topItems.shows.slice(0, LIST_LENGTH),
                },
                {
                  heading: t('Email.yourTopMovies'),
                  items: topItems.movies.slice(0, LIST_LENGTH),
                },
                {
                  heading: t('Email.yourTopArtists'),
                  items: topItems.audio.slice(0, LIST_LENGTH),
                },
              ],
              intl,
            ),
          ]
        : [
            ...intro,
            {
              type: 'paragraph',
              text: t(`Email.Newsletter.noPlays.${frequency}`),
            },
          ],
    )
  } else {
    panels.push(intro)
  }

  if (isServerShown) {
    panels.push([
      {
        type: 'eyebrow',
        text: t('Email.Newsletter.onServer', { server: serverName }),
      },
      {
        type: 'tiles',
        tiles: [
          {
            label: t('Common.duration'),
            value: formatDuration(serverTotals.duration, intl),
          },
          {
            label: t('Common.plays'),
            value: format.number(serverTotals.plays),
          },
          {
            label: t('Email.Newsletter.viewers'),
            value: format.number(server.users.length),
          },
        ],
      },
      ...getItemColumns(
        [
          {
            heading: t('Email.Newsletter.topShows'),
            items: server.topItems.shows.slice(0, SERVER_LIST_LENGTH),
          },
          {
            heading: t('Email.Newsletter.topMovies'),
            items: server.topItems.movies.slice(0, SERVER_LIST_LENGTH),
          },
          {
            heading: t('Email.Newsletter.topArtists'),
            items: server.topItems.audio.slice(0, SERVER_LIST_LENGTH),
          },
        ],
        intl,
      ),
    ])
  }

  if (isRanksShown && server.users.length > 1) {
    const readerRank = server.users.findIndex(
      (user) => user.id === recipient.id,
    )

    panels.push([
      { type: 'heading', text: t('Email.Newsletter.topUsers') },
      {
        type: 'ranks',
        rows: server.users.slice(0, RANKS_LENGTH).map((user, i) => {
          const isHidden =
            settings.general.isAnonymized && user.id !== recipient.id

          return {
            name: isHidden
              ? t('Email.anonymous', { number: i + 1 })
              : user.name,
            // Nothing that would tell a hidden user apart
            avatarUrl: isHidden ? null : user.avatarUrl,
            initials: isHidden ? '' : getInitials(user.name),
            value: formatDuration(user.duration, intl),
            isReader: user.id === recipient.id,
          }
        }),
      },
      ...(readerRank >= RANKS_LENGTH
        ? [
            {
              type: 'paragraph',
              text: t('Email.Newsletter.yourRank', {
                rank: readerRank + 1,
                count: server.users.length,
              }),
              isMuted: true,
            } satisfies EmailBlock,
          ]
        : []),
    ])
  }

  const lastPanel = panels[panels.length - 1]

  lastPanel.push({
    type: 'button',
    href: settings.dashboard.isActive ? toAppUrl(appUrl, '/dashboard') : appUrl,
    label: t('Email.Newsletter.button'),
  })

  const unsubscribeUrl = getUnsubscribeUrl(appUrl, recipient.id)
  const subject = t(`Email.Newsletter.subject.${frequency}`, {
    server: serverName,
    month,
  })
  const { html, text } = renderEmail({
    locale: intl.locale,
    subject,
    preheader: t('Email.Newsletter.preheader', { server: serverName }),
    serverName,
    logoUrl,
    panels,
    footer: t(`Email.Newsletter.footer.${frequency}`, { server: serverName }),
    footerLink: unsubscribeUrl
      ? { href: unsubscribeUrl, label: t('Email.Newsletter.unsubscribe') }
      : undefined,
  })

  return {
    status: 'ready',
    email: {
      to: recipient.address,
      subject,
      html,
      text,
      headers: unsubscribeUrl
        ? {
            // Lets mail apps offer their own unsubscribe button, which posts
            // to the link without opening it
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined,
    },
  }
}

// Sent from the settings to check the mail server
export function buildTestEmail(
  settings: Settings,
  intl: EmailIntl,
  to: string,
): OutgoingEmail {
  const { t } = intl
  const serverName = settings.general.serverName || APP_NAME
  const subject = t('Email.Test.subject', { app: APP_NAME })
  const { html, text } = renderEmail({
    locale: intl.locale,
    subject,
    preheader: t('Email.Test.body'),
    serverName,
    logoUrl: LOGO_URL,
    panels: [
      [
        { type: 'eyebrow', text: APP_NAME },
        { type: 'title', text: t('Email.Test.title') },
        { type: 'paragraph', text: t('Email.Test.body') },
      ],
    ],
  })

  return { to, subject, html, text }
}
