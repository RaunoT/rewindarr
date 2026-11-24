import { LOCALES } from '@/utils/constants'
import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const PUBLIC_DIR = path.join(process.cwd(), 'public')

describe('static offline fallback', () => {
  it('renders a standalone reload link without inline scripts', () => {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, 'offline.html'), 'utf-8')
    const inlineScripts = [...html.matchAll(/<script\b([^>]*)>/gi)].filter(
      ([, attrs]) => !/\bsrc=/i.test(attrs),
    )

    expect(inlineScripts).toEqual([])
    expect(html).toContain('<script src="/offline.js" defer></script>')
    expect(html).toMatch(/<a\b[^>]*\bhref=""[^>]*>/)
  })

  it('covers every configured app language in offline.js', () => {
    const script = fs.readFileSync(path.join(PUBLIC_DIR, 'offline.js'), 'utf-8')
    const languages = new Set(LOCALES.map((locale) => locale.split('-')[0]))

    for (const language of languages) {
      expect(script).toMatch(new RegExp(`\\b${language}:\\s*\\{`))
    }
  })
})
