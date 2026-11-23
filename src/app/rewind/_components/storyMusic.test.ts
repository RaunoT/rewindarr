import { describe, expect, it } from 'vitest'
import { getCountdownMusic, getStepMusic } from './storyMusic'

describe('getStepMusic', () => {
  const stepMusic = [
    { step: 3, music: ['theme'] },
    { step: 1, music: ['other'] },
  ]

  it("plays the story's music before a step has its own", () => {
    expect(getStepMusic(['track'], stepMusic, 0)).toEqual(['track'])
  })

  it('plays the latest step that has its own', () => {
    expect(getStepMusic(['track'], stepMusic, 1)).toEqual(['other'])
    expect(getStepMusic(['track'], stepMusic, 2)).toEqual(['other'])
    expect(getStepMusic(['track'], stepMusic, 3)).toEqual(['theme'])
    expect(getStepMusic(['track'], stepMusic, 4)).toEqual(['theme'])
  })

  it("plays the story's music without any for its steps", () => {
    expect(getStepMusic(['track'], [], 2)).toEqual(['track'])
  })
})

describe('getCountdownMusic', () => {
  it('plays each place from the step that shows it, the last place first', () => {
    expect(getCountdownMusic([['first'], ['second'], ['third']])).toEqual([
      { step: 0, music: ['third'] },
      { step: 1, music: ['second'] },
      { step: 2, music: ['first'] },
    ])
  })

  it('has nothing to play without places', () => {
    expect(getCountdownMusic([])).toEqual([])
  })
})
