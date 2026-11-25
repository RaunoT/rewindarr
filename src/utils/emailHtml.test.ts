import { describe, expect, it } from 'vitest'
import { escapeHtml, html, Html, renderEmail } from './emailHtml'

describe('html', () => {
  it('escapes what goes in', () => {
    expect(html`<p>${'<b>"Tom" & Jerry\'s</b>'}</p>`.value).toBe(
      '<p>&lt;b&gt;&quot;Tom&quot; &amp; Jerry&#39;s&lt;/b&gt;</p>',
    )
  })

  it("keeps what's already HTML, and joins lists", () => {
    expect(html`${['a', new Html('<b>b</b>')]}`.value).toBe('a<b>b</b>')
  })

  it('leaves out nothing values', () => {
    expect(html`${null}${undefined}${false}${0}`.value).toBe('0')
  })
})

describe('escapeHtml', () => {
  it('leaves plain text as it is', () => {
    expect(escapeHtml('Plain text')).toBe('Plain text')
  })
})

describe('renderEmail', () => {
  const { html: body, text } = renderEmail({
    locale: 'en-GB',
    subject: 'Your week',
    preheader: 'What you played',
    serverName: 'Home <Server>',
    logoUrl: 'https://rewind.example.com/icon-192x192.png',
    panels: [
      [
        { type: 'title', text: 'Your week, Alex' },
        {
          type: 'tiles',
          tiles: [
            { label: 'Watch time', value: '5 hrs' },
            { label: 'Plays', value: '12' },
          ],
        },
        {
          type: 'items',
          items: [
            {
              title: 'Severance',
              meta: '4 plays',
              imageUrl: 'https://image.tmdb.org/t/p/w300/a.jpg',
            },
            { title: 'Dune', meta: '1 play', imageUrl: 'javascript:alert(1)' },
          ],
        },
        { type: 'button', href: 'https://rewind.example.com', label: 'Open' },
      ],
    ],
    footer: 'You get this weekly.',
    footerLink: {
      href: 'https://rewind.example.com/api/email/unsubscribe',
      label: 'Unsubscribe',
    },
  })

  it('renders a whole document with its text escaped', () => {
    expect(body.startsWith('<!doctype html><html lang="en-GB">')).toBe(true)
    expect(body).toContain('Home &lt;Server&gt;')
    expect(body).toContain('Severance')
    expect(body).toContain('https://image.tmdb.org/t/p/w300/a.jpg')
  })

  it('only links to web addresses', () => {
    expect(body).not.toContain('javascript:')
  })

  it('has a plain text copy with the links spelled out', () => {
    expect(text).toContain('Home <Server>')
    expect(text).toContain('Watch time: 5 hrs')
    expect(text).toContain('1. Severance - 4 plays')
    expect(text).toContain('Open: https://rewind.example.com')
    expect(text).toContain(
      'Unsubscribe: https://rewind.example.com/api/email/unsubscribe',
    )
  })
})
