'use client'

import clsx from 'clsx'
import Image, { ImageProps } from 'next/image'
import { useCallback, useState } from 'react'

type Props = Omit<ImageProps, 'fill' | 'onLoad'> & {
  // Pulses in the frame until the picture is there, like a skeleton
  hasPlaceholder?: boolean
  // Shown as it loads, for pictures drawn into a saved image, which would
  // otherwise catch them hidden or halfway through fading in
  isInstant?: boolean
}

// A picture that fills its parent and fades in once it has loaded, so it
// doesn't appear in pieces or all at once. One that's already cached shows
// straight away.
export default function FadeInImage({
  src,
  alt,
  className,
  hasPlaceholder,
  isInstant,
  ...props
}: Props) {
  const [loadedSrc, setLoadedSrc] = useState<Props['src'] | null>(null)
  const [cachedSrc, setCachedSrc] = useState<Props['src'] | null>(null)
  const isLoaded = loadedSrc === src
  const isCached = cachedSrc === src
  // Before the first paint, so a cached picture never starts out hidden
  const ref = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete && image.naturalWidth) {
        setCachedSrc(src)
        setLoadedSrc(src)
      }
    },
    [src],
  )

  return (
    <>
      {hasPlaceholder && !isInstant && !isLoaded && (
        <span
          aria-hidden
          className='absolute inset-0 animate-pulse bg-white/10'
        />
      )}
      {/* A new element for each picture, so the last one doesn't fade out
          while the next loads */}
      <Image
        key={typeof src === 'string' ? src : undefined}
        {...props}
        ref={ref}
        fill
        src={src}
        alt={alt}
        className={clsx(
          className,
          !isInstant &&
            !isCached &&
            'transition-opacity duration-300 motion-reduce:transition-none',
          !isInstant && !isLoaded && 'opacity-0!',
        )}
        onLoad={() => setLoadedSrc(src)}
      />
    </>
  )
}
