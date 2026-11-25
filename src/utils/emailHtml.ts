// The building blocks of the emails. Mail apps drop most CSS, so the layout
// is made of tables with inline styles, and the few rules in the head only
// stack the columns on phones. The colours follow the app: white on black,
// with panels a shade lighter.

// Text put in with `html` is escaped, unless it's already Html
export class Html {
  constructor(readonly value: string) {}

  toString(): string {
    return this.value
  }
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char])
}

function toHtml(value: unknown): string {
  if (value instanceof Html) {
    return value.value
  }

  if (Array.isArray(value)) {
    return value.map(toHtml).join('')
  }

  if (value === null || value === undefined || value === false) {
    return ''
  }

  return escapeHtml(String(value))
}

export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Html {
  return new Html(
    strings.reduce(
      (result, string, i) =>
        result + string + (i < values.length ? toHtml(values[i]) : ''),
      '',
    ),
  )
}

export const COLORS = {
  page: '#000000',
  panel: '#0f0f0f',
  tile: '#1a1a1a',
  border: '#262626',
  highlight: '#2a2a2a',
  buttonBorder: '#525252',
  avatar: '#3f3f46',
  text: '#ffffff',
  body: '#d4d4d4',
  muted: '#a3a3a3',
  faint: '#737373',
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
// The space between blocks in a panel. A list's rows have room around them
// already, so less is added next to one, and every gap looks the same.
const GAP = {
  afterEyebrow: 12,
  afterTitle: 8,
  // Over a heading, and between the sections it starts
  section: 28,
  afterHeading: 16,
  beforeButton: 24,
  default: 16,
}
const LIST_INSET = 8
// Over the second of two columns, once they're stacked on a phone
const COLUMN_STACK_GAP = GAP.section - LIST_INSET

// Only links are safe in an href, so nothing else can run when it's clicked
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : '#'
}

type LayoutProps = {
  locale: string
  // The email's subject, which some apps show as the title
  title: string
  // The line inbox lists show after the subject
  preheader: string
  serverName: string
  logoUrl: string | null
  content: Html
  footer?: Html
}

export function renderLayout({
  locale,
  title,
  preheader,
  serverName,
  logoUrl,
  content,
  footer,
}: LayoutProps): string {
  // Keeps the inbox preview from going on into the email's text
  const previewFiller = '&#847;&zwnj;&nbsp;'.repeat(60)

  return `<!doctype html>${html`<html lang="${locale}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="x-apple-disable-message-reformatting" />
      <meta name="color-scheme" content="dark" />
      <meta name="supported-color-schemes" content="dark" />
      <title>${title}</title>
      <style>
        :root {
          color-scheme: dark;
          supported-color-schemes: dark;
        }
        body {
          margin: 0;
          padding: 0;
          background: ${COLORS.page};
        }
        a {
          color: ${COLORS.text};
        }
        img {
          border: 0;
          outline: none;
          text-decoration: none;
        }
        @media (max-width: 540px) {
          .page {
            padding: 16px 8px !important;
          }
          .panel {
            padding: 24px 20px !important;
            border-radius: 20px !important;
          }
          .column {
            display: block !important;
            width: 100% !important;
            padding: 0 !important;
          }
          .column-next {
            padding-top: ${COLUMN_STACK_GAP}px !important;
          }
          .title {
            font-size: 26px !important;
            line-height: 32px !important;
          }
          .tile {
            padding: 12px !important;
          }
          .tile-value {
            font-size: 17px !important;
            line-height: 22px !important;
          }
        }
      </style>
    </head>
    <body
      style="margin: 0; padding: 0; background: ${COLORS.page}; color: ${COLORS.body}; font-family: ${FONT};"
    >
      <div
        style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;"
      >
        ${preheader}${new Html(previewFiller)}
      </div>
      <table
        role="presentation"
        width="100%"
        cellpadding="0"
        cellspacing="0"
        border="0"
        bgcolor="${COLORS.page}"
        style="background: ${COLORS.page};"
      >
        <tr>
          <td class="page" align="center" style="padding: 32px 16px;">
            <table
              role="presentation"
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="max-width: 560px; font-family: ${FONT};"
            >
              <tr>
                <td style="padding: 0 4px 20px;">
                  <table
                    role="presentation"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                  >
                    <tr>
                      ${
                        logoUrl &&
                        html`<td
                          style="padding-right: 10px; vertical-align: middle;"
                        >
                          <img
                            src="${safeUrl(logoUrl)}"
                            width="28"
                            height="28"
                            alt=""
                            style="display: block; border-radius: 8px;"
                          />
                        </td>`
                      }
                      <td
                        style="vertical-align: middle; color: ${COLORS.text}; font-size: 15px; font-weight: 600; letter-spacing: 0.2px;"
                      >
                        ${serverName}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              ${content}
              ${
                footer &&
                html`<tr>
                  <td
                    align="center"
                    style="padding: 0 4px; color: ${COLORS.faint}; font-size: 12px; line-height: 18px; text-align: center;"
                  >
                    ${footer}
                  </td>
                </tr>`
              }
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`}`
}

// A rounded panel, like the app's sheets. Panels follow each other with a gap.
export function panel(content: Html): Html {
  return html`<tr>
    <td style="padding-bottom: 12px;">
      <table
        role="presentation"
        width="100%"
        cellpadding="0"
        cellspacing="0"
        border="0"
        bgcolor="${COLORS.panel}"
        style="background: ${COLORS.panel}; border: 1px solid ${COLORS.border}; border-radius: 24px;"
      >
        <tr>
          <td class="panel" style="padding: 32px;">${content}</td>
        </tr>
      </table>
    </td>
  </tr>`
}

// Small capitals over a section, like the settings' headings
export function eyebrow(text: string): Html {
  return html`<p
    style="margin: 0; color: ${COLORS.muted}; font-size: 11px; line-height: 16px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;"
  >
    ${text}
  </p>`
}

export function title(text: string): Html {
  return html`<h1
    class="title"
    style="margin: 0; color: ${COLORS.text}; font-size: 30px; line-height: 36px; font-weight: 700; letter-spacing: -0.5px;"
  >
    ${text}
  </h1>`
}

// The app's icons for the headings, as pictures, since mail apps don't show
// SVG. On the project's site, like the logo, so any mail app can load them.
export type EmailIcon = 'movie' | 'show' | 'artist' | 'users'

const ICON_SIZE = 20
// Raise the version once changed icons are on the site: Apple Mail's proxy
// keeps what it fetched for a URL, including a failure from before.
const ICON_VERSION = 2

function iconUrl(icon: EmailIcon): string {
  return `https://rewindarr.eu/assets/email/${icon}.png?v=${ICON_VERSION}`
}

export function heading(text: string, icon?: EmailIcon): Html {
  const h2 = html`<h2
    style="margin: 0; color: ${COLORS.text}; font-size: 18px; line-height: 24px; font-weight: 600;"
  >
    ${text}
  </h2>`

  if (!icon) {
    return h2
  }

  return html`<table
    role="presentation"
    cellpadding="0"
    cellspacing="0"
    border="0"
  >
    <tr>
      <td style="padding-right: 8px; vertical-align: middle;">
        <img
          src="${iconUrl(icon)}"
          width="${ICON_SIZE}"
          height="${ICON_SIZE}"
          alt=""
          style="display: block;"
        />
      </td>
      <td style="vertical-align: middle;">${h2}</td>
    </tr>
  </table>`
}

export function paragraph(content: string | Html, isMuted = false): Html {
  return html`<p
    style="margin: 0; color: ${isMuted ? COLORS.muted : COLORS.body}; font-size: 15px; line-height: 22px;"
  >
    ${content}
  </p>`
}

// A round button like the app's glass ones. Not its white one: mail apps that
// darken light colours for dark mode, like Gmail's, turn a white button grey
// with light text, while dark colours and white text stay as they are.
export function button(href: string, label: string): Html {
  return html`<table
    role="presentation"
    cellpadding="0"
    cellspacing="0"
    border="0"
  >
    <tr>
      <td
        bgcolor="${COLORS.highlight}"
        style="background: ${COLORS.highlight}; border: 1px solid ${COLORS.buttonBorder}; border-radius: 999px;"
      >
        <a
          href="${safeUrl(href)}"
          target="_blank"
          style="display: inline-block; padding: 12px 28px; color: ${COLORS.text}; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 999px;"
          >${label}</a
        >
      </td>
    </tr>
  </table>`
}

// The same button, sending a form, for the pages the emails link to
export function submitButton(action: string, label: string): Html {
  return html`<form method="post" action="${action}" style="margin: 0;">
    <button
      type="submit"
      style="padding: 12px 28px; border: 0; border-radius: 999px; background: ${COLORS.text}; color: #000000; font-family: ${FONT}; font-size: 15px; font-weight: 600; line-height: normal; cursor: pointer;"
    >
      ${label}
    </button>
  </form>`
}

export type StatTile = {
  label: string
  value: string
  detail?: string
}

// Side by side, smaller on phones. Three get a smaller value, so a long
// watch time fits.
export function statTiles(tiles: StatTile[]): Html {
  const gap = 8
  const width = `${Math.floor(100 / tiles.length)}%`
  const valueSize = tiles.length > 2 ? 19 : 22

  // The tiles are cells of one row, with gaps between them, so they're all
  // as tall as the tallest
  return html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="table-layout: fixed;"
  >
    <tr>
      ${tiles.map(
        (tile, i) =>
          html`${
              i > 0 && html`<td width="${gap}" style="width: ${gap}px;"></td>`
            }
            <td
              class="tile"
              width="${width}"
              bgcolor="${COLORS.tile}"
              style="width: ${width}; padding: 16px; vertical-align: top; background: ${COLORS.tile}; border-radius: 16px;"
            >
              <p
                style="margin: 0 0 4px; color: ${COLORS.muted}; font-size: 12px; line-height: 16px;"
              >
                ${tile.label}
              </p>
              <p
                class="tile-value"
                style="margin: 0; color: ${COLORS.text}; font-size: ${valueSize}px; line-height: ${valueSize + 6}px; font-weight: 700;"
              >
                ${tile.value}
              </p>
              ${tile.detail && html`<p style="margin: 4px 0 0; color: ${COLORS.muted}; font-size: 12px; line-height: 16px;">${tile.detail}</p>`}
            </td>`,
      )}
    </tr>
  </table>`
}

export type ListItem = {
  title: string
  meta: string
  // A poster anyone can load, as mail apps can't sign in to the media server
  imageUrl?: string | null
}

const POSTER_WIDTH = 40
const POSTER_HEIGHT = 60

// Skips "The", so The Rolling Stones get an R
function getInitial(title: string): string {
  const name = title.replace(/^the\s+/i, '').trim() || title

  return Array.from(name)[0]?.toLocaleUpperCase() ?? ''
}

// Gold, silver and bronze for the top three, like the app's. Solid, as mail
// apps don't clip a gradient to text.
const RANK_COLORS = ['#facc15', '#e5e5e5', '#fb923c']

function getRankColor(index: number): string {
  return RANK_COLORS[index] ?? COLORS.faint
}

// A ranked list of titles with their posters
export function itemList(items: ListItem[]): Html {
  return html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
  >
    ${items.map(
      (item, i) =>
        html`<tr>
          <td
            width="24"
            style="width: 24px; padding: 8px 0; color: ${getRankColor(i)}; font-size: 13px; font-weight: 700; vertical-align: middle;"
          >
            ${i + 1}
          </td>
          <td
            width="${POSTER_WIDTH}"
            style="width: ${POSTER_WIDTH}px; padding: 8px 12px 8px 0; vertical-align: middle;"
          >
            ${
              item.imageUrl
                ? html`<img
                    src="${safeUrl(item.imageUrl)}"
                    width="${POSTER_WIDTH}"
                    height="${POSTER_HEIGHT}"
                    alt=""
                    style="display: block; width: ${POSTER_WIDTH}px; height: ${POSTER_HEIGHT}px; border-radius: 6px; object-fit: cover; background: ${COLORS.tile};"
                  />`
                : // Artists and titles TMDB doesn't know get their initial instead
                  html`<div
                    style="width: ${POSTER_WIDTH}px; height: ${POSTER_WIDTH}px; border-radius: 999px; background: ${COLORS.highlight}; color: ${COLORS.muted}; font-size: 16px; font-weight: 600; line-height: ${POSTER_WIDTH}px; text-align: center;"
                  >
                    ${getInitial(item.title)}
                  </div>`
            }
          </td>
          <td
            style="padding: 8px 0; vertical-align: middle; border-bottom: ${i < items.length - 1 ? `1px solid ${COLORS.border}` : '0'};"
          >
            <p
              style="margin: 0; color: ${COLORS.text}; font-size: 15px; line-height: 20px; font-weight: 600;"
            >
              ${item.title}
            </p>
            <p
              style="margin: 2px 0 0; color: ${COLORS.muted}; font-size: 13px; line-height: 18px;"
            >
              ${item.meta}
            </p>
          </td>
        </tr>`,
    )}
  </table>`
}

export type RankRow = {
  name: string
  // Their initials show without one
  avatarUrl?: string | null
  initials?: string
  value: string
  isReader: boolean
}

const AVATAR_SIZE = 28

// Round, or the initials on a grey circle, like the app's avatars
function avatar(row: RankRow): Html {
  return row.avatarUrl
    ? html`<img
        src="${safeUrl(row.avatarUrl)}"
        width="${AVATAR_SIZE}"
        height="${AVATAR_SIZE}"
        alt=""
        style="display: block; border-radius: 50%;"
      />`
    : html`<div
        style="width: ${AVATAR_SIZE}px; height: ${AVATAR_SIZE}px; border-radius: 50%; background: ${COLORS.avatar}; color: ${COLORS.body}; font-size: 11px; font-weight: 600; line-height: ${AVATAR_SIZE}px; text-align: center;"
      >
        ${row.initials ?? ''}
      </div>`
}

// Who watched the most, with the reader's own row lit up
export function rankList(rows: RankRow[]): Html {
  return html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="border-collapse: separate;"
  >
    ${rows.map(
      (row, i) =>
        html`<tr>
          <td
            width="32"
            bgcolor="${row.isReader ? COLORS.highlight : COLORS.panel}"
            style="width: 32px; padding: 10px 0 10px 12px; color: ${getRankColor(i)}; font-size: 13px; font-weight: 700; background: ${row.isReader ? COLORS.highlight : COLORS.panel}; border-radius: 12px 0 0 12px;"
          >
            ${i + 1}
          </td>
          <td
            width="${AVATAR_SIZE}"
            bgcolor="${row.isReader ? COLORS.highlight : COLORS.panel}"
            style="width: ${AVATAR_SIZE}px; padding: 6px 0 6px 4px; background: ${row.isReader ? COLORS.highlight : COLORS.panel};"
          >
            ${avatar(row)}
          </td>
          <td
            bgcolor="${row.isReader ? COLORS.highlight : COLORS.panel}"
            style="padding: 10px 8px 10px 12px; color: ${COLORS.text}; font-size: 15px; font-weight: ${row.isReader ? 700 : 500}; background: ${row.isReader ? COLORS.highlight : COLORS.panel};"
          >
            ${row.name}
          </td>
          <td
            align="right"
            bgcolor="${row.isReader ? COLORS.highlight : COLORS.panel}"
            style="padding: 10px 12px 10px 8px; color: ${COLORS.muted}; font-size: 13px; white-space: nowrap; background: ${row.isReader ? COLORS.highlight : COLORS.panel}; border-radius: 0 12px 12px 0;"
          >
            ${row.value}
          </td>
        </tr>`,
    )}
  </table>`
}

// Two lists side by side, stacked on phones
export function columns(left: Html, right: Html): Html {
  return html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
  >
    <tr>
      <td
        class="column"
        width="50%"
        style="width: 50%; padding-right: 12px; vertical-align: top;"
      >
        ${left}
      </td>
      <td
        class="column column-next"
        width="50%"
        style="width: 50%; padding-left: 12px; vertical-align: top;"
      >
        ${right}
      </td>
    </tr>
  </table>`
}

export function link(href: string, label: string): Html {
  return html`<a
    href="${safeUrl(href)}"
    target="_blank"
    style="color: ${COLORS.muted}; text-decoration: underline;"
    >${label}</a
  >`
}

// An email is described once in blocks, and rendered both as HTML and as the
// plain text that goes with it
export type EmailBlock =
  | { type: 'eyebrow' | 'title'; text: string }
  | { type: 'heading'; text: string; icon?: EmailIcon }
  | { type: 'paragraph'; text: string; isMuted?: boolean }
  | { type: 'tiles'; tiles: StatTile[] }
  | { type: 'items'; items: ListItem[] }
  | { type: 'ranks'; rows: RankRow[] }
  | { type: 'columns'; left: EmailBlock[]; right: EmailBlock[] }
  | { type: 'button'; href: string; label: string }
  // Only for pages, as mail apps don't send forms
  | { type: 'form'; action: string; label: string }

export type EmailDocument = {
  locale: string
  subject: string
  preheader: string
  serverName: string
  logoUrl: string | null
  // Each is a panel of its own
  panels: EmailBlock[][]
  footer?: string
  footerLink?: { href: string; label: string }
}

function blockToHtml(block: EmailBlock): Html {
  switch (block.type) {
    case 'eyebrow':
      return eyebrow(block.text)
    case 'title':
      return title(block.text)
    case 'heading':
      return heading(block.text, block.icon)
    case 'paragraph':
      return paragraph(block.text, block.isMuted)
    case 'tiles':
      return statTiles(block.tiles)
    case 'items':
      return itemList(block.items)
    case 'ranks':
      return rankList(block.rows)
    case 'columns':
      return columns(renderBlocks(block.left), renderBlocks(block.right))
    case 'button':
      return button(block.href, block.label)
    case 'form':
      return submitButton(block.action, block.label)
  }
}

// The block a gap is next to, for columns the one at their edge
function getEdge(block: EmailBlock, side: 'first' | 'last'): EmailBlock {
  if (block.type !== 'columns') {
    return block
  }

  const edge = side === 'first' ? block.left[0] : block.left.at(-1)

  return edge ? getEdge(edge, side) : block
}

function getGap(previous: EmailBlock, next: EmailBlock): number {
  const before = getEdge(previous, 'last').type
  const after = getEdge(next, 'first').type
  const inset =
    (before === 'items' ? LIST_INSET : 0) + (after === 'items' ? LIST_INSET : 0)

  let gap = GAP.default

  if (before === 'eyebrow') {
    gap = GAP.afterEyebrow
  } else if (after === 'heading') {
    gap = GAP.section
  } else if (before === 'title') {
    gap = GAP.afterTitle
  } else if (before === 'heading') {
    gap = GAP.afterHeading
  } else if (after === 'button' || after === 'form') {
    gap = GAP.beforeButton
  }

  return Math.max(gap - inset, 0)
}

function spacer(height: number): Html {
  return html`<div
    style="height: ${height}px; line-height: ${height}px; font-size: 1px; mso-line-height-rule: exactly;"
  >
    &nbsp;
  </div>`
}

// Blocks one under the other, with the same gaps everywhere
export function renderBlocks(blocks: EmailBlock[]): Html {
  return html`${blocks.map(
    (block, i) =>
      html`${i > 0 && spacer(getGap(blocks[i - 1], block))}${blockToHtml(block)}`,
  )}`
}

function blockToText(block: EmailBlock): string {
  switch (block.type) {
    case 'eyebrow':
      return block.text.toUpperCase()
    case 'title':
    case 'heading':
      return `${block.text}\n${'-'.repeat(Math.min(block.text.length, 60))}`
    case 'paragraph':
      return block.text
    case 'tiles':
      return block.tiles
        .map(
          (tile) =>
            `${tile.label}: ${tile.value}${tile.detail ? ` (${tile.detail})` : ''}`,
        )
        .join('\n')
    case 'items':
      return block.items
        .map((item, i) => `${i + 1}. ${item.title} - ${item.meta}`)
        .join('\n')
    case 'ranks':
      return block.rows
        .map(
          (row, i) =>
            `${i + 1}. ${row.name} - ${row.value}${row.isReader ? ' *' : ''}`,
        )
        .join('\n')
    case 'columns':
      return [...block.left, ...block.right].map(blockToText).join('\n\n')
    case 'button':
      return `${block.label}: ${block.href}`
    case 'form':
      return `${block.label}: ${block.action}`
  }
}

export function renderEmail(document: EmailDocument): {
  html: string
  text: string
} {
  const footer =
    document.footer || document.footerLink
      ? html`${document.footer}${
          document.footerLink &&
          // On a line of its own, after the text
          html`${document.footer && html`<br />`}${link(
            document.footerLink.href,
            document.footerLink.label,
          )}`
        }`
      : undefined

  return {
    html: renderLayout({
      locale: document.locale,
      title: document.subject,
      preheader: document.preheader,
      serverName: document.serverName,
      logoUrl: document.logoUrl,
      content: html`${document.panels.map((blocks) =>
        panel(renderBlocks(blocks)),
      )}`,
      footer,
    }),
    text: [
      document.serverName,
      ...document.panels.map((blocks) => blocks.map(blockToText).join('\n\n')),
      [
        document.footer,
        document.footerLink &&
          `${document.footerLink.label}: ${document.footerLink.href}`,
      ]
        .filter(Boolean)
        .join('\n'),
    ]
      .filter(Boolean)
      .join('\n\n\n'),
  }
}
