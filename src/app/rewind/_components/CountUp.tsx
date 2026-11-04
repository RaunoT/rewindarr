'use client'

import usePrefersReducedMotion from '@/hooks/usePrefersReducedMotion'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useFormatter } from 'next-intl'
import { ReactNode, useEffect, useState } from 'react'

type Props = {
  value: number
  // The formatted number, which keeps its room while the count runs and is
  // what screen readers get
  children: ReactNode
}

// Counting to a handful would look like a glitch
const MIN_VALUE = 10

// Counts up to a number as its statement shows
export default function CountUp({ value, children }: Props) {
  const format = useFormatter()
  const shouldReduceMotion = usePrefersReducedMotion()
  const isAnimated = !shouldReduceMotion && value >= MIN_VALUE
  const [isCounting, setIsCounting] = useState(isAnimated)
  const count = useMotionValue(0)
  const text = useTransform(count, (latest) =>
    format.number(Math.round(latest)),
  )
  // Reduced motion can turn on midway, which stops the count
  const isCountShown = isAnimated && isCounting

  useEffect(() => {
    if (!isAnimated) {
      return
    }

    const controls = animate(count, value, {
      duration: 1.2,
      ease: 'easeOut',
      onComplete: () => setIsCounting(false),
    })

    return () => controls.stop()
  }, [count, value, isAnimated])

  return (
    <span className='relative inline-block tabular-nums'>
      <span className={isCountShown ? 'opacity-0' : undefined}>{children}</span>
      {isCountShown && (
        <motion.span className='absolute inset-0' aria-hidden='true'>
          {text}
        </motion.span>
      )}
    </span>
  )
}
