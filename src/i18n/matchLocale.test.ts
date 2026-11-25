import { describe, expect, it } from 'vitest'
import { isLocale, matchLocale } from './matchLocale'

describe('isLocale', () => {
  it('accepts supported locales and rejects unsupported values', () => {
    expect(isLocale('en-GB')).toBe(true)
    expect(isLocale('en-US')).toBe(true)
    expect(isLocale('et')).toBe(true)
    expect(isLocale('en')).toBe(false)
    expect(isLocale('fr-CA')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })
})

describe('matchLocale', () => {
  it('matches exact region tags before base-language fallbacks', () => {
    expect(matchLocale(['en-US', 'fr'])).toBe('en-US')
    expect(matchLocale(['en-AU'])).toBe('en-GB')
    expect(matchLocale(['fr-CA'])).toBe('fr')
  })

  it('normalizes whitespace and casing while skipping unknown tags', () => {
    expect(matchLocale([' ', 'pt-BR', '  EN-us  '])).toBe('en-US')
    expect(matchLocale(['', 'ja', 'ko'])).toBeUndefined()
  })
})
