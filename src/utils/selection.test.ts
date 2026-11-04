import { describe, expect, it } from 'vitest'
import { clearAll, selectAll } from './selection'

describe('selectAll', () => {
  it('picks every option once', () => {
    expect(selectAll(['b'], ['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
  })

  it('keeps picked values that are not offered', () => {
    expect(selectAll(['gone'], ['a'])).toEqual(['gone', 'a'])
  })
})

describe('clearAll', () => {
  it('drops every option', () => {
    expect(clearAll(['a', 'b'], ['a', 'b', 'c'])).toEqual([])
  })

  it('keeps picked values that are not offered', () => {
    expect(clearAll(['a', 'gone'], ['a', 'b'])).toEqual(['gone'])
  })
})
