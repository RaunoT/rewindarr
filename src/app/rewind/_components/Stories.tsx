'use client'

import {
  readStorage,
  writeStorage,
} from '@/app/_components/GlobalContextProvider'
import Loader from '@/components/Loader'
import useFullscreen from '@/hooks/useFullscreen'
import useStoryMusic from '@/hooks/useStoryMusic'
import { trackEvent } from '@/utils/analytics'
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { MotionConfig } from 'motion/react'
import { useTranslations } from 'next-intl'
import {
  createContext,
  Fragment,
  PointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import StoriesIntro from './StoriesIntro'
import StoryBackdrop from './StoryBackdrop'

type StoryStep = {
  // The latest statement shown, by its step in the story
  step: number
  registerStep: (step: number) => () => void
}

// The story's current step, which each statement reads to know whether to
// show, so the controls can step from statement to statement
export const StoryStepContext = createContext<StoryStep>({
  step: 0,
  registerStep: () => () => {},
})

// Lets the last story offer to start over
export const StoryRestartContext = createContext<() => void>(() => {})

export type Story = {
  // Names the story in analytics
  id: string
  // What plays during the story, in order of preference
  music?: string[]
  // The art behind the story, tried in turn
  art?: string[]
} & (
  | { type: 'component'; component: () => ReactNode }
  // Still on the way, so it shows as loading
  | { type: 'loading' }
)

type StoryView = {
  story: string
  story_number: number
}

type Props = {
  stories: Story[]
  classNames?: {
    main?: string
    storyContainer?: string
  }
}

const INTRO_SEEN_KEY = 'rewindIntroSeen'
const SOUND_KEY = 'rewindSound'
const NO_MUSIC: string[] = []
const NO_ART: string[] = []
// A longer press or a drag doesn't count as a tap
const TAP_MAX_DURATION = 500
const TAP_MAX_DISTANCE = 10
// Without a cursor or arrow keys, the tap areas aren't obvious
const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'
// Anything that already owns Space/arrow keys or taps must not drive the stories
const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="listbox"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="slider"]',
  '[role="dialog"]',
  '[data-trigger]',
].join(',')

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && !!target.closest(INTERACTIVE_SELECTOR)
}

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)

  return () => document.removeEventListener('visibilitychange', onChange)
}

function getIsHidden() {
  return document.hidden
}

// Counts as hidden until hydrated, so nothing plays before then
function getServerIsHidden() {
  return true
}

export default function Stories({ stories }: Props) {
  const t = useTranslations('Rewind.Stories')
  const [currentIndex, setCurrentIndex] = useState(0)
  // Unknown until mounted, so the first story waits for it
  const [isIntroShown, setIsIntroShown] = useState<boolean | null>(null)
  const [isSoundOn, setIsSoundOn] = useState(false)
  // The browser wouldn't start the music before the visitor interacted
  const [isSoundBlocked, setIsSoundBlocked] = useState(false)
  // The tracks a click started, null before one. Safari only plays those, and
  // the stories still on the way bring more.
  const [unlockedMusic, setUnlockedMusic] = useState<string[] | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [step, setStep] = useState(0)
  // The steps of the current story's statements
  const [steps, setSteps] = useState<number[]>([])
  const isHidden = useSyncExternalStore(
    subscribeToVisibility,
    getIsHidden,
    getServerIsHidden,
  )
  const sectionRef = useRef<HTMLElement>(null)
  const slideRef = useRef<HTMLDivElement>(null)
  const introButtonRef = useRef<HTMLButtonElement>(null)
  const soundButtonRef = useRef<HTMLButtonElement>(null)
  const shouldRestoreFocusRef = useRef(false)
  const shouldSeekToEndRef = useRef(false)
  const trackedIndexRef = useRef<number | null>(null)
  // Views wait here until every story is in, as each carries the count
  const untrackedViewsRef = useRef<StoryView[]>([])
  const hasTrackedCompleteRef = useRef(false)
  const tapStartRef = useRef<{
    pointerId: number
    x: number
    y: number
    time: number
  } | null>(null)
  const currentStory = stories[currentIndex]
  const currentStoryId = currentStory?.id
  const isCurrentStoryIn = currentStory?.type === 'component'
  // The stories still on the way can leave some out, so until they're in,
  // neither the count nor the progress bar is known
  const isComplete = stories.every((story) => story.type === 'component')
  // The card, so the art and the snow fill the screen too
  const getPlayer = useCallback(
    () => sectionRef.current?.closest('.rewind-player'),
    [],
  )
  const fullscreen = useFullscreen(getPlayer)
  const musicUrls = useMemo(
    () => [...new Set(stories.flatMap((story) => story.music ?? []))],
    [stories],
  )
  const hasLockedMusic =
    !!unlockedMusic && musicUrls.some((url) => !unlockedMusic.includes(url))
  const waitForInteraction = useCallback(() => setIsSoundBlocked(true), [])
  const { unlock } = useStoryMusic({
    sources: currentStory?.music ?? NO_MUSIC,
    isPlaying: isSoundOn && !isHidden && isIntroShown === false,
    onBlocked: waitForInteraction,
  })
  const unlockMusic = useCallback(() => {
    unlock(musicUrls)
    setUnlockedMusic(musicUrls)
  }, [unlock, musicUrls])
  const getPositionLabel = useCallback(
    (index: number) =>
      isComplete
        ? t('storyPosition', { current: index + 1, total: stories.length })
        : t('storyNumber', { current: index + 1 }),
    [isComplete, stories.length, t],
  )
  // A statement that is left out leaves a gap in the steps, which is skipped
  const storySteps = useMemo(
    () => [...new Set(steps)].sort((a, b) => a - b),
    [steps],
  )
  const nextStep = storySteps.find((other) => other > step)
  const shownSteps = storySteps.filter((other) => other <= step)
  // Fills as the story's statements are stepped through
  const progress = storySteps.length ? shownSteps.length / storySteps.length : 0
  const canGoBack = currentIndex > 0 || shownSteps.length > 1
  // A story still on the way holds the viewer there, or it would arrive
  // behind them
  const canGoForward =
    isCurrentStoryIn &&
    (currentIndex < stories.length - 1 || nextStep !== undefined)
  const goTo = useCallback(
    (index: number, isAtEnd = false) => {
      if (index < 0 || index >= stories.length || index === currentIndex) {
        return
      }

      // The slide is about to unmount, so keep focus from dropping to <body>
      if (slideRef.current?.contains(document.activeElement)) {
        shouldRestoreFocusRef.current = true
      }

      // Going back lands on the previous story's last statement
      shouldSeekToEndRef.current = isAtEnd
      setStep(0)
      setCurrentIndex(index)
      setAnnouncement(getPositionLabel(index))
    },
    [currentIndex, stories.length, getPositionLabel],
  )
  const goToNext = useCallback(() => {
    if (!isCurrentStoryIn) {
      return
    }

    if (nextStep !== undefined) {
      setStep(nextStep)
    } else {
      goTo(currentIndex + 1)
    }
  }, [goTo, currentIndex, nextStep, isCurrentStoryIn])
  // Hides the latest statement, or goes back a story from the first one
  const goToPrev = useCallback(() => {
    if (shownSteps.length > 1) {
      setStep(shownSteps[shownSteps.length - 2])
    } else {
      goTo(currentIndex - 1, true)
    }
  }, [goTo, currentIndex, shownSteps])
  const registerStep = useCallback((statementStep: number) => {
    setSteps((prev) => [...prev, statementStep])

    return () =>
      setSteps((prev) => {
        const index = prev.indexOf(statementStep)

        return index === -1
          ? prev
          : [...prev.slice(0, index), ...prev.slice(index + 1)]
      })
  }, [])
  const restart = useCallback(() => goTo(0), [goTo])
  const dismissIntro = useCallback(() => {
    // Still dismissed when storage is blocked, it just shows again next time
    writeStorage(INTRO_SEEN_KEY, 'true')
    // The slide can only take focus once it's no longer inert
    shouldRestoreFocusRef.current = true
    setIsIntroShown(false)

    // The music waits for the intro, and this click lets it start
    if (isSoundOn) {
      unlockMusic()
    }
  }, [isSoundOn, unlockMusic])
  // Music that waits for a click shows as off, so the button starts it
  const isSoundAudible = isSoundOn && !isSoundBlocked
  const toggleSound = useCallback(() => {
    const isOn = !isSoundAudible

    if (isOn) {
      unlockMusic()
    }

    setIsSoundOn(isOn)
    setIsSoundBlocked(false)
    writeStorage(SOUND_KEY, isOn ? 'on' : 'off')
  }, [isSoundAudible, unlockMusic])
  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    tapStartRef.current =
      !e.isPrimary ||
      (e.pointerType === 'mouse' && e.button !== 0) ||
      isInteractiveTarget(e.target)
        ? null
        : {
            pointerId: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            time: e.timeStamp,
          }
  }, [])
  // Only a tap that started on the slide steps the story
  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const tapStart = tapStartRef.current

      tapStartRef.current = null

      if (
        !tapStart ||
        tapStart.pointerId !== e.pointerId ||
        e.timeStamp - tapStart.time > TAP_MAX_DURATION ||
        Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) >
          TAP_MAX_DISTANCE ||
        isInteractiveTarget(e.target)
      ) {
        return
      }

      const rect = e.currentTarget.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const isLeftSide = clickX < rect.width / 3

      if (isLeftSide) {
        goToPrev()
      } else {
        goToNext()
      }
    },
    [goToNext, goToPrev],
  )

  useEffect(() => {
    // The new story's statements have registered by now
    if (shouldSeekToEndRef.current) {
      shouldSeekToEndRef.current = false
      setStep(Math.max(0, ...steps))
    }
  }, [steps])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIntroShown(
      window.matchMedia(TOUCH_QUERY).matches && !readStorage(INTRO_SEEN_KEY),
    )
    // On unless the visitor turned it off
    setIsSoundOn(readStorage(SOUND_KEY) !== 'off')
  }, [])

  // Browsers only start audio on a click or a key press, so blocked music
  // starts on the visitor's first one, wherever it is, as does the music of
  // the stories that came in after the sound was let through
  useEffect(() => {
    if ((!isSoundBlocked && !hasLockedMusic) || !isSoundOn) {
      return
    }

    const listeners = new AbortController()
    const start = (e: Event) => {
      // The sound button has its own say
      if (soundButtonRef.current?.contains(e.target as Node)) {
        return
      }

      listeners.abort()
      setIsSoundBlocked(false)
      unlockMusic()
    }

    document.addEventListener('click', start, {
      capture: true,
      signal: listeners.signal,
    })
    document.addEventListener('keydown', start, {
      capture: true,
      signal: listeners.signal,
    })

    return () => listeners.abort()
  }, [isSoundBlocked, hasLockedMusic, isSoundOn, unlockMusic])

  useEffect(() => {
    if (isIntroShown) {
      introButtonRef.current?.focus({ preventScroll: true })
    }
  }, [isIntroShown])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.defaultPrevented ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.shiftKey ||
        isInteractiveTarget(e.target)
      ) {
        return
      }

      if (e.key === 'ArrowLeft') {
        goToPrev()
      } else if (e.key === 'ArrowRight') {
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNext, goToPrev])

  useEffect(() => {
    // The refs keep Strict Mode's second run, or a re-render, from counting
    // the same view again. A story still on the way counts once it's in.
    if (!isCurrentStoryIn) {
      trackedIndexRef.current = null
    } else if (currentStoryId && trackedIndexRef.current !== currentIndex) {
      trackedIndexRef.current = currentIndex
      untrackedViewsRef.current.push({
        story: currentStoryId,
        story_number: currentIndex + 1,
      })
    }

    if (!isComplete) {
      return
    }

    for (const view of untrackedViewsRef.current.splice(0)) {
      trackEvent('rewind_story_view', { ...view, story_count: stories.length })
    }

    if (currentIndex === stories.length - 1 && !hasTrackedCompleteRef.current) {
      hasTrackedCompleteRef.current = true
      trackEvent('rewind_complete', { story_count: stories.length })
    }
  }, [
    currentIndex,
    currentStoryId,
    isCurrentStoryIn,
    isComplete,
    stories.length,
  ])

  useEffect(() => {
    if (shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false
      slideRef.current?.focus({ preventScroll: true })
    }
  }, [currentIndex, isIntroShown])

  // A story scrolled down on a phone doesn't leave the next one scrolled
  useEffect(() => {
    slideRef.current?.scrollTo({ top: 0 })
  }, [currentIndex])

  const storyStep = useMemo(
    () => ({ step, registerStep }),
    [step, registerStep],
  )
  // Only re-created when the slide or stories change, so the active slide
  // doesn't re-render on each step; its statements read the step
  const slide = useMemo(
    () =>
      currentStory ? (
        <Fragment key={currentIndex}>
          {currentStory.type === 'component' ? (
            currentStory.component()
          ) : (
            // Only shows when it takes a moment
            <div className='animate-fade-in animation-delay-300'>
              <Loader />
            </div>
          )}
        </Fragment>
      ) : null,
    [currentIndex, currentStory],
  )

  if (!currentStory) return null

  return (
    <MotionConfig reducedMotion='user'>
      <StoryBackdrop
        srcs={currentStory.art ?? NO_ART}
        nextSrcs={stories[currentIndex + 1]?.art ?? NO_ART}
      />
      <section
        ref={sectionRef}
        // Hidden behind the intro, which covers the whole player
        className={clsx(
          'relative flex flex-1 flex-col max-sm:min-h-0',
          isIntroShown && 'invisible',
        )}
        aria-roledescription='carousel'
        aria-label={t('label')}
      >
        {/* Progress bar */}
        <div
          className='absolute -top-4 -right-0.5 -left-0.5 z-20 flex'
          inert={!!isIntroShown}
        >
          {/* As on the loading page, until the stories are all in */}
          {!isComplete && (
            <div className='flex-1 px-0.5 py-4'>
              <div className='skeleton h-1' />
            </div>
          )}
          {isComplete &&
            stories.map((_, index) => (
              <button
                key={index}
                className='group flex-1 cursor-pointer overflow-hidden px-0.5 py-4'
                onClick={() => goTo(index)}
                aria-label={t('goToStory', { index: index + 1 })}
                aria-current={index === currentIndex ? 'step' : undefined}
              >
                <span className='block h-1 overflow-hidden rounded-full bg-white/15 transition-colors group-hover:bg-white/30'>
                  {index < currentIndex ? (
                    <span className='link-dark block h-full w-full bg-white' />
                  ) : index === currentIndex ? (
                    <span
                      className='link-dark block h-full w-full origin-left bg-white transition-transform duration-300 ease-out'
                      style={{ transform: `scaleX(${progress})` }}
                    />
                  ) : null}
                </span>
              </button>
            ))}
        </div>

        {/* Story content with tap navigation */}
        <div
          ref={slideRef}
          role='group'
          aria-roledescription='slide'
          aria-label={getPositionLabel(currentIndex)}
          tabIndex={-1}
          inert={!!isIntroShown}
          // A phone's screen can be shorter than a story, which then scrolls
          // between the progress bar and the buttons
          className='relative w-full flex-1 pt-8 outline-none select-none [-webkit-touch-callout:none] max-sm:min-h-0 max-sm:overflow-y-auto max-sm:overscroll-contain sm:flex sm:flex-col sm:justify-center'
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            tapStartRef.current = null
          }}
        >
          <StoryRestartContext value={restart}>
            {/* The first story starts once the intro is dismissed */}
            <StoryStepContext value={storyStep}>
              {!isIntroShown && slide}
            </StoryStepContext>
          </StoryRestartContext>
        </div>

        <div className='mt-4 flex justify-between gap-2' inert={!!isIntroShown}>
          <div className='icon-button-group'>
            <button
              className='icon-button'
              onClick={goToPrev}
              disabled={!canGoBack}
              aria-label={t('previous')}
            >
              <ChevronLeftIcon className='size-5' />
            </button>
            <button
              className='icon-button'
              onClick={goToNext}
              disabled={!canGoForward}
              aria-label={t('next')}
            >
              <ChevronRightIcon className='size-5' />
            </button>
          </div>
          {(musicUrls.length > 0 || fullscreen.isSupported) && (
            <div
              className={clsx(
                'icon-button-group',
                // Full screen is only offered on wider screens
                !musicUrls.length && 'max-sm:hidden',
              )}
            >
              {musicUrls.length > 0 && (
                <button
                  ref={soundButtonRef}
                  className='icon-button'
                  onClick={toggleSound}
                  aria-pressed={isSoundAudible}
                  aria-label={t('sound')}
                >
                  {isSoundAudible ? (
                    <SpeakerWaveIcon className='size-5' />
                  ) : (
                    <SpeakerXMarkIcon className='size-5' />
                  )}
                </button>
              )}
              {fullscreen.isSupported && (
                <button
                  className='icon-button max-sm:hidden'
                  onClick={fullscreen.toggle}
                  aria-pressed={fullscreen.isFullscreen}
                  aria-label={t('fullscreen')}
                >
                  {fullscreen.isFullscreen ? (
                    <ArrowsPointingInIcon className='size-5' />
                  ) : (
                    <ArrowsPointingOutIcon className='size-5' />
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <div className='sr-only' aria-live='polite' aria-atomic='true'>
          {announcement}
        </div>
      </section>

      {isIntroShown && (
        <StoriesIntro buttonRef={introButtonRef} onDismiss={dismissIntro} />
      )}
    </MotionConfig>
  )
}
