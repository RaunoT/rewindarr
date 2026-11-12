import { describe, expect, it } from 'vitest'
import { joinStorySections, removeHiddenStories } from './storySections'

describe('joinStorySections', () => {
  it('joins the sections in order once they are all in', () => {
    expect(
      joinStorySections([['welcome'], ['total'], ['months', 'goodbye']], '…'),
    ).toEqual(['welcome', 'total', 'months', 'goodbye'])
  })

  it('ends with the pending story at the first section still on the way', () => {
    expect(joinStorySections([['welcome'], ['total'], null], '…')).toEqual([
      'welcome',
      'total',
      '…',
    ])
  })

  it('holds back the sections after one still on the way', () => {
    expect(
      joinStorySections([['welcome'], null, ['months', 'goodbye']], '…'),
    ).toEqual(['welcome', '…'])
  })

  it('stands in for every story when the first section is on the way', () => {
    expect(joinStorySections([null, ['total']], '…')).toEqual(['…'])
  })

  it('skips the sections without stories', () => {
    expect(joinStorySections([['welcome'], [], ['goodbye']], '…')).toEqual([
      'welcome',
      'goodbye',
    ])
    expect(joinStorySections([['welcome'], [], null], '…')).toEqual([
      'welcome',
      '…',
    ])
  })
})

describe('removeHiddenStories', () => {
  const stories = [
    { id: 'welcome' },
    { id: 'total' },
    { id: 'months' },
    { id: 'goodbye' },
  ]

  it('leaves out the hidden stories and keeps the order of the rest', () => {
    expect(removeHiddenStories(stories, ['total', 'libraries'])).toEqual([
      { id: 'welcome' },
      { id: 'months' },
      { id: 'goodbye' },
    ])
  })

  it('keeps every story when none are hidden', () => {
    expect(removeHiddenStories(stories, [])).toEqual(stories)
  })
})
