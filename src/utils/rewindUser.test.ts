import { describe, expect, it } from 'vitest'
import { getRewindUserName } from './rewindUser'

describe('getRewindUserName', () => {
  it("takes the source's friendly name", () => {
    expect(
      getRewindUserName(
        { friendly_name: 'Rauno T', username: 'raunot' },
        'Rauno Tegelmann',
      ),
    ).toBe('Rauno T')
  })

  it('falls back to the username without a friendly name', () => {
    expect(
      getRewindUserName(
        { friendly_name: '', username: 'raunot' },
        'Rauno Tegelmann',
      ),
    ).toBe('raunot')
  })

  it("falls back to the account's name for a user the source doesn't know", () => {
    expect(getRewindUserName(undefined, 'Rauno Tegelmann')).toBe(
      'Rauno Tegelmann',
    )
    expect(getRewindUserName(undefined)).toBe('')
  })
})
