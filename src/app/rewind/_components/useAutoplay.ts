import { useMotionValue } from 'motion/react'
import { RefObject, useEffect, useRef } from 'react'
import { getStatementDuration, StatementContent } from './autoplay'

type Options = {
  slideRef: RefObject<HTMLElement | null>
  // The statement on screen, by its story and its step in it
  storyIndex: number
  step: number
  isStoryEnd: boolean
  // The clock stops where it is while this is off
  isRunning: boolean
  // How much of the story's progress bar is filled before the statement, and
  // with it
  from: number
  to: number
  onEnd: () => void
}

type Timer = {
  // The statement it times
  key: string
  elapsed: number
  // Not measured until the clock first runs
  content?: StatementContent | null
}

// Text from this size up is the statement itself, in rem. The smaller text
// belongs to its cards and lists.
const HEADLINE_FONT_SIZE = 1.25
// Narrower images are icons, such as the ratings' logos
const MIN_IMAGE_WIDTH = 40
// What the bar charts are marked with
const CHART_SELECTOR = '[data-story-chart]'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

// Leaves out the places a countdown hasn't reached, which keep their room
// unseen, the copies made for the saved image and the counting numbers, and
// what only screen readers get
function isShown(element: Element) {
  return (
    !element.closest('[aria-hidden="true"], .sr-only') &&
    (element.checkVisibility?.({ visibilityProperty: true }) ?? true)
  )
}

function measure(statements: Iterable<Element>): StatementContent {
  const content = { headline: 0, detail: 0, images: 0, charts: 0 }
  const headlineFontSize =
    parseFloat(getComputedStyle(document.documentElement).fontSize) *
    HEADLINE_FONT_SIZE

  for (const statement of statements) {
    const texts = document.createTreeWalker(statement, NodeFilter.SHOW_TEXT)

    for (let text = texts.nextNode(); text; text = texts.nextNode()) {
      const parent = text.parentElement
      const length = text.textContent?.trim().length

      if (!parent || !length || !isShown(parent)) {
        continue
      }

      if (parseFloat(getComputedStyle(parent).fontSize) >= headlineFontSize) {
        content.headline += length
      } else {
        content.detail += length
      }
    }

    // A picture that's missing has a stand-in, which is one all the same
    content.images += [
      ...statement.querySelectorAll(`img, [role="img"]:not(${CHART_SELECTOR})`),
    ].filter(
      (image) => image.clientWidth >= MIN_IMAGE_WIDTH && isShown(image),
    ).length
    content.charts += statement.querySelectorAll(CHART_SELECTOR).length
  }

  return content
}

// Times the statement on screen by how much there is to take in, and calls
// `onEnd` when its time is up. Returns how much of the story's progress bar
// is filled, which fills as the time runs.
export default function useAutoplay({
  slideRef,
  storyIndex,
  step,
  isStoryEnd,
  isRunning,
  from,
  to,
  onEnd,
}: Options) {
  const progress = useMotionValue(0)
  const timerRef = useRef<Timer>({ key: '', elapsed: 0 })
  const onEndRef = useRef(onEnd)

  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    const key = `${storyIndex}:${step}`
    const slide = slideRef.current

    if (timerRef.current.key !== key) {
      timerRef.current = { key, elapsed: 0 }
    }

    const timer = timerRef.current

    if (isRunning && slide && timer.content === undefined) {
      // Each statement is marked with its step
      const statements = slide.querySelectorAll(`[data-story-step="${step}"]`)

      timer.content = statements.length ? measure(statements) : null

      // A phone's screen can be shorter than a story, and the statements
      // after the first can come in below it
      if (step > 0) {
        statements[statements.length - 1]?.scrollIntoView({
          block: 'nearest',
          behavior: window.matchMedia(REDUCED_MOTION_QUERY).matches
            ? 'auto'
            : 'smooth',
        })
      }
    }

    const duration =
      timer.content === undefined
        ? null
        : getStatementDuration(timer.content, isStoryEnd)

    function update() {
      const share = duration ? Math.min(timer.elapsed / duration, 1) : 0

      progress.set(from + (to - from) * share)

      return share
    }

    update()

    if (!isRunning || !duration) {
      return
    }

    let last: number | null = null
    let frame = requestAnimationFrame(function tick(now) {
      if (last !== null) {
        timer.elapsed += now - last
      }

      last = now

      if (update() < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        onEndRef.current()
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [slideRef, storyIndex, step, isStoryEnd, isRunning, from, to, progress])

  return progress
}
