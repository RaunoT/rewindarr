import { RefObject, useEffect } from 'react'
import { getMoreBelow } from './slideFade'

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

    function update() {
      if (!slide) {
        return
      }

      const moreBelow = getMoreBelow(
        slide.scrollHeight,
        slide.scrollTop,
        slide.clientHeight,
      )

      if (moreBelow) {
        slide.style.setProperty('--more-below', `${moreBelow}px`)
      } else {
        slide.style.removeProperty('--more-below')
      }
    }

    // The slide changes size with the screen, and its story as statements
    // come in or the next story replaces it
    const resizeObserver = new ResizeObserver(update)

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

    const mutationObserver = new MutationObserver(observe)

    observe()
    mutationObserver.observe(slide, { childList: true })
    slide.addEventListener('scroll', update, { passive: true })

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      slide.removeEventListener('scroll', update)
      slide.style.removeProperty('--more-below')
    }
  }, [slideRef, isMounted])
}
