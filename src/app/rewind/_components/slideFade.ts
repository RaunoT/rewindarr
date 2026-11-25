// How far the shown part of a scrolled story reaches below the bottom of the
// screen, in whole pixels, so a slide scrolled to its end, or one that fits,
// has none
export function getMoreBelow(
  shownBottom: number,
  scrollTop: number,
  clientHeight: number,
) {
  return Math.max(0, Math.floor(shownBottom - scrollTop - clientHeight))
}

// How far a story is scrolled down, in whole pixels, leaving out the bounce
// past its start
export function getScrolled(scrollTop: number) {
  return Math.max(0, Math.floor(scrollTop))
}

export type SlideLayout<T> = {
  getChildren: (element: T) => Iterable<T>
  // An element without a box of its own, such as one with `display:
  // contents`, only lays out its children
  getVisibility: (element: T) => 'shown' | 'hidden' | 'boxless'
  // Where it ends in the slide as laid out, before the transforms that move
  // statements in
  getBottom: (element: T) => number
}

type ShownBottom = { bottom: number; isPartlyHidden: boolean }

function getElementBottom<T>(
  element: T,
  layout: SlideLayout<T>,
): ShownBottom | null {
  const visibility = layout.getVisibility(element)

  if (visibility === 'hidden') {
    return null
  }

  let childrenBottom = 0
  let isPartlyHidden = false

  for (const child of layout.getChildren(element)) {
    const shown = getElementBottom(child, layout)

    if (!shown) {
      isPartlyHidden = true
      continue
    }

    isPartlyHidden ||= shown.isPartlyHidden
    childrenBottom = Math.max(childrenBottom, shown.bottom)
  }

  return {
    bottom:
      isPartlyHidden || visibility === 'boxless'
        ? childrenBottom
        : layout.getBottom(element),
    isPartlyHidden,
  }
}

// The bottom of what a slide shows. The room something hidden keeps, such as
// the places a countdown hasn't reached, doesn't count, so an element with a
// hidden part ends where the lowest of its shown parts does.
export function getShownBottom<T>(slide: T, layout: SlideLayout<T>) {
  let bottom = 0

  for (const child of layout.getChildren(slide)) {
    bottom = Math.max(bottom, getElementBottom(child, layout)?.bottom ?? 0)
  }

  return bottom
}
