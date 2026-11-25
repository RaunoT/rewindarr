import { RefObject, useEffect } from 'react'
import { getMoreBelow, getShownBottom, SlideLayout } from './slideFade'

function getLayout(slide: HTMLElement): SlideLayout<HTMLElement> {
  return {
    getChildren: (element) =>
      [...element.children].filter((child) => child instanceof HTMLElement),
    getVisibility: (element) => {
      const style = getComputedStyle(element)

      if (style.display === 'contents') {
        return 'boxless'
      }

      return (element.checkVisibility?.({ visibilityProperty: true }) ??
        style.visibility !== 'hidden')
        ? 'shown'
        : 'hidden'
    },
    // Offsets leave out transforms, so a statement still sliding in from
    // below doesn't count as more below
    getBottom: (element) => {
      let top = 0
      let current: Element | null = element

      while (current instanceof HTMLElement && current !== slide) {
        top += current.offsetTop
        current = current.offsetParent
      }

      return current === slide ? top + element.offsetHeight : 0
    },
  }
}

// Keeps `--more-below` on a slide that scrolls up to date, which its fade at
// the bottom is sized by. Set on the element rather than through state, so
// scrolling doesn't re-render the stories.
export default function useSlideFade(
  slideRef: RefObject<HTMLElement | null>,
  isMounted: boolean,
) {
  useEffect(() => {
    const slide = slideRef.current

    if (!isMounted || !slide) {
      return
    }

    const layout = getLayout(slide)

    let shownBottom = 0
    let frame = 0

    function update() {
      if (!slide) {
        return
      }

      const moreBelow = getMoreBelow(
        shownBottom,
        slide.scrollTop,
        slide.clientHeight,
      )

      if (moreBelow) {
        slide.style.setProperty('--more-below', `${moreBelow}px`)
      } else {
        slide.style.removeProperty('--more-below')
      }
    }

    function measure() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!slide) {
          return
        }

        shownBottom = getShownBottom(slide, layout)
        update()
      })
    }

    // The slide changes size with the screen, and its story as statements
    // come in or the next story replaces it
    const resizeObserver = new ResizeObserver(measure)

    function observe() {
      if (!slide) {
        return
      }

      resizeObserver.disconnect()
      resizeObserver.observe(slide)

      for (const child of slide.children) {
        resizeObserver.observe(child)
      }
    }

    // A countdown's place takes over its placeholder's room, and a part can
    // be hidden by its class, without a resize. Counting numbers only change
    // text, which is left out.
    const mutationObserver = new MutationObserver((mutations) => {
      if (
        mutations.some(
          (mutation) =>
            mutation.type === 'childList' && mutation.target === slide,
        )
      ) {
        observe()
      }

      if (
        mutations.some(
          (mutation) =>
            mutation.type === 'attributes' ||
            [...mutation.addedNodes, ...mutation.removedNodes].some(
              (node) => node instanceof Element,
            ),
        )
      ) {
        measure()
      }
    })

    observe()
    mutationObserver.observe(slide, {
      childList: true,
      subtree: true,
      attributeFilter: ['class'],
    })
    slide.addEventListener('scroll', update, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      slide.removeEventListener('scroll', update)
      slide.style.removeProperty('--more-below')
    }
  }, [slideRef, isMounted])
}
