'use client'

import usePrefersReducedMotion from '@/hooks/usePrefersReducedMotion'
import { instantTransition } from '@/utils/motion'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import Image, { getImageProps } from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getArtDimming, getVisibleArea, WHITE_ART_DIMMING } from './storyArt'

type Props = {
  // The story's art, tried in turn, and the next story's. Empty without any.
  srcs: string[]
  nextSrcs: string[]
}

// Blurred to its colours, so a small image does
const SIZES = '5rem'
// The blur's radius in pixels, and how much the art is scaled up from the
// middle, so the blur's faded edges are cut off
const BLUR = 40
const SCALE = 1.5
const FADE = { duration: 0.8, ease: 'easeInOut' } as const
// Enough pixels to find the art's brightest part
const SAMPLE_SIZE = 64

// Only the part of the art that shows counts. The art is drawn whole first,
// as browsers disagree on what part of a responsive image a crop refers to.
function measureDimming(image: HTMLImageElement) {
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const art = {
      width: SAMPLE_SIZE,
      height: Math.max(
        Math.round((SAMPLE_SIZE * image.naturalHeight) / image.naturalWidth),
        1,
      ),
    }
    const area = getVisibleArea(
      art,
      { width: image.clientWidth, height: image.clientHeight },
      SCALE,
      BLUR,
    )

    if (!context) {
      return WHITE_ART_DIMMING
    }

    canvas.width = art.width
    canvas.height = art.height
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, art.width, art.height)

    // Rounded outwards, so no part that shows is left out
    const left = Math.floor(area.x)
    const top = Math.floor(area.y)

    return getArtDimming(
      context.getImageData(
        left,
        top,
        Math.ceil(area.x + area.width) - left,
        Math.ceil(area.y + area.height) - top,
      ).data,
    )
  } catch {
    // Art from another origin can't be read, so it's dimmed as if white
    return WHITE_ART_DIMMING
  }
}

type ArtProps = {
  src: string
  isInstant: boolean
  onError: () => void
}

// Fades in once it has loaded and been measured, so it never shows half drawn
// or too bright
function Art({ src, isInstant, onError }: ArtProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const dimmingRef = useRef<number | null>(null)
  // More dimming applies at once, so the text never sits on art brighter than
  // it allows, while less fades in
  const [dimming, setDimming] = useState<{
    value: number
    isInstant: boolean
  } | null>(null)
  const measure = useCallback(() => {
    const image = imageRef.current

    if (image?.complete && image.naturalWidth) {
      const value = measureDimming(image)
      const previous = dimmingRef.current

      dimmingRef.current = value
      setDimming({ value, isInstant: previous !== null && value > previous })
    }
  }, [])

  // How much of the art shows depends on the card's shape, which changes in
  // full screen
  useEffect(() => {
    const image = imageRef.current

    if (!image) {
      return
    }

    const observer = new ResizeObserver(measure)

    observer.observe(image)

    return () => observer.disconnect()
  }, [measure])

  return (
    <motion.div
      className='absolute inset-0'
      initial={{ opacity: 0 }}
      animate={{ opacity: dimming === null ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={isInstant ? instantTransition : FADE}
    >
      <Image
        ref={imageRef}
        fill
        className='object-cover'
        style={{ filter: `blur(${BLUR}px)`, scale: SCALE }}
        alt=''
        src={src}
        sizes={SIZES}
        onLoad={measure}
        onError={onError}
      />
      <div
        className={clsx(
          'absolute inset-0 bg-black',
          !dimming?.isInstant &&
            'transition-opacity duration-700 motion-reduce:transition-none',
        )}
        style={{ opacity: dimming?.value ?? 1 }}
      />
    </motion.div>
  )
}

// The art of the title a story is about, behind the story and the snow. It
// fills the card, which fills the screen on phones and in full screen.
export default function StoryBackdrop({ srcs, nextSrcs }: Props) {
  const shouldReduceMotion = usePrefersReducedMotion()
  const [failedSrcs, setFailedSrcs] = useState<string[]>([])
  const src = srcs.find((source) => !failedSrcs.includes(source))
  const nextSrc = nextSrcs.find((source) => !failedSrcs.includes(source))

  // Loaded ahead, so the next story's art is there to fade in
  useEffect(() => {
    if (!nextSrc) {
      return
    }

    const { props } = getImageProps({
      fill: true,
      alt: '',
      src: nextSrc,
      sizes: SIZES,
    })
    const image = new window.Image()

    image.fetchPriority = 'low'
    image.sizes = props.sizes ?? ''
    image.srcset = props.srcSet ?? ''
    image.src = props.src
  }, [nextSrc])

  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]'
    >
      <AnimatePresence>
        {src && (
          <Art
            key={src}
            src={src}
            isInstant={shouldReduceMotion}
            onError={() => setFailedSrcs((failed) => [...failed, src])}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
