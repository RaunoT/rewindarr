import { describe, expect, it } from 'vitest'
import { getMoreBelow, getShownBottom, SlideLayout } from './slideFade'

type Box = {
  bottom: number
  isHidden?: boolean
  isBoxless?: boolean
  children?: Box[]
}

const layout: SlideLayout<Box> = {
  getChildren: (box) => box.children ?? [],
  getVisibility: (box) =>
    box.isHidden ? 'hidden' : box.isBoxless ? 'boxless' : 'shown',
  getBottom: (box) => box.bottom,
}

function slide(...children: Box[]): Box {
  return { bottom: 680, children }
}

describe('getMoreBelow', () => {
  it('measures what is left below the screen', () => {
    expect(getMoreBelow(800, 0, 680)).toBe(120)
    expect(getMoreBelow(800, 100, 680)).toBe(20)
  })

  it('has nothing below a story that fits', () => {
    expect(getMoreBelow(680, 0, 680)).toBe(0)
  })

  it('has nothing below once scrolled to the end', () => {
    expect(getMoreBelow(800, 120, 680)).toBe(0)
  })

  it('ignores the part of a pixel a zoomed screen leaves', () => {
    expect(getMoreBelow(800, 119.5, 680)).toBe(0)
  })

  it('has nothing below while the scroll bounces past the end', () => {
    expect(getMoreBelow(800, 140, 680)).toBe(0)
  })
})

describe('getShownBottom', () => {
  it('ends with the lowest part of the story', () => {
    expect(
      getShownBottom(slide({ bottom: 300 }, { bottom: 760 }), layout),
    ).toBe(760)
  })

  it('takes a fully shown element as a whole, with its padding', () => {
    const card = { bottom: 520, children: [{ bottom: 500 }] }

    expect(getShownBottom(slide(card), layout)).toBe(520)
  })

  it('leaves out the room of the places a countdown has not reached', () => {
    const list = {
      bottom: 900,
      children: [
        { bottom: 400 },
        { bottom: 600 },
        { bottom: 750, isHidden: true },
        { bottom: 900, isHidden: true },
      ],
    }
    const statement = { bottom: 900, children: [{ bottom: 120 }, list] }

    expect(getShownBottom(slide(statement), layout)).toBe(600)
  })

  it('looks inside the shown parts of a partly hidden element', () => {
    const row = { bottom: 640, children: [{ bottom: 630 }] }
    const list = {
      bottom: 900,
      children: [row, { bottom: 900, isHidden: true }],
    }

    expect(
      getShownBottom(slide({ bottom: 900, children: [list] }), layout),
    ).toBe(640)
  })

  it('looks through an element without a box of its own', () => {
    const details = { bottom: 0, isBoxless: true, children: [{ bottom: 767 }] }
    const row = {
      bottom: 900,
      children: [{ bottom: 731 }, details, { bottom: 900, isHidden: true }],
    }

    expect(getShownBottom(slide(row), layout)).toBe(767)
  })

  it('has no bottom when nothing is shown', () => {
    expect(getShownBottom(slide(), layout)).toBe(0)
    expect(getShownBottom(slide({ bottom: 800, isHidden: true }), layout)).toBe(
      0,
    )
  })
})
