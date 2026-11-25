'use client'

import usePrefersReducedMotion from '@/hooks/usePrefersReducedMotion'
import { instantTransition } from '@/utils/motion'
import clsx from 'clsx'
import { motion } from 'motion/react'
import { useFormatter } from 'next-intl'
import { useLayoutEffect, useRef, useState } from 'react'
import { fitSpanLabels, SpanLabelFit } from './spanLabels'

type Props = {
  data: number[]
  peakIndex: number | null
  labels?: (string | null)[]
  // In place of the labels on wider screens, where the bars have more room
  wideLabels?: (string | null)[]
  // A second row under the labels, from the bar each one starts at, such as
  // the year of each January
  yearLabels?: (string | null)[] | null
  ariaLabel: string
  axisLabel: string
  className?: string
}

// Rounds the axis up to a "nice" maximum and returns evenly spaced ticks, so
// the gridlines land on readable values (0, 20, 40, …) rather than the raw max.
function getScale(maxValue: number) {
  const rawStep = maxValue / 4
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalized = rawStep / magnitude
  const niceStep =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) *
    magnitude
  const step = Math.max(Math.round(niceStep), 1)
  const niceMax = Math.ceil(maxValue / step) * step
  const ticks: number[] = []

  for (let tick = 0; tick <= niceMax; tick += step) {
    ticks.push(tick)
  }

  return { niceMax, ticks }
}

// Labels are centered on their bar. When only some bars have one, as on the
// 24-hour view, a label can be wider than its bar, so one near an edge is
// clamped to the plot bounds — anchored by its left edge at the start and its
// right edge at the end — so it can never be clipped.
function labelTransform(index: number, labels: (string | null)[]) {
  const count = labels.length

  if (count <= 12 || labels.every(Boolean)) {
    return 'translateX(-50%)'
  }

  const position = (index + 0.5) / count

  if (position <= 0.12) {
    return 'translateX(0)'
  }

  if (position >= 0.88) {
    return 'translateX(-100%)'
  }

  return 'translateX(-50%)'
}

type BarLabelsProps = {
  labels: (string | null)[]
  peakIndex: number | null
  className?: string
}

function BarLabels({ labels, peakIndex, className }: BarLabelsProps) {
  return (
    <div className={clsx('absolute inset-0', className)}>
      {labels.map((label, index) =>
        label ? (
          <span
            key={index}
            className={clsx(
              'absolute top-0 text-xs whitespace-nowrap',
              index === peakIndex
                ? 'text-plex font-semibold'
                : 'text-neutral-400',
            )}
            style={{
              left: `${((index + 0.5) / labels.length) * 100}%`,
              transform: labelTransform(index, labels),
            }}
          >
            {label}
          </span>
        ) : null,
      )}
    </div>
  )
}

// Each starts at its bar's left edge, with a tick there, so it marks where
// what it names begins. They're measured once laid out, so one that would run
// past the plot's end is set against it, without the tick, and one that would
// run into the next is hidden, at any width and in any language.
function SpanLabels({ labels }: { labels: (string | null)[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState<SpanLabelFit[] | null>(null)
  const spans = labels.flatMap((label, index) =>
    label ? [{ label, start: index / labels.length }] : [],
  )

  useLayoutEffect(() => {
    const container = ref.current

    if (!container) {
      return
    }

    function measure() {
      if (!container) {
        return
      }

      const plotWidth = container.clientWidth
      const boxes = [...container.children].map((child, index) => ({
        start: spans[index].start * plotWidth,
        width: (child as HTMLElement).offsetWidth,
      }))

      setFits(fitSpanLabels(boxes, plotWidth))
    }

    measure()

    const observer = new ResizeObserver(measure)

    observer.observe(container)

    return () => observer.disconnect()
    // The spans are new on every render, and only change with the labels
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [labels])

  return (
    <div ref={ref} className='relative mt-1 h-4'>
      {spans.map(({ label, start }, index) => {
        const fit = fits?.[index]

        return (
          <span
            key={index}
            className={clsx(
              'absolute top-0 border-l pl-1 text-xs whitespace-nowrap text-neutral-500 tabular-nums',
              // As wide either way, so it measures the same
              fit?.isEndAligned
                ? 'right-0 border-transparent'
                : 'border-white/25',
              // Measured before it's shown
              (!fit || fit.isHidden) && 'invisible',
            )}
            style={fit?.isEndAligned ? undefined : { left: `${start * 100}%` }}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}

export default function RewindBarChart({
  data,
  peakIndex,
  labels,
  wideLabels,
  yearLabels,
  ariaLabel,
  axisLabel,
  className,
}: Props) {
  const { niceMax, ticks } = getScale(Math.max(...data, 1))
  const shouldReduceMotion = usePrefersReducedMotion()
  const format = useFormatter()

  return (
    <div
      className={clsx('w-full not-italic', className)}
      // Read as one image with its label, not bar by bar
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role='img'
      aria-label={ariaLabel}
      // Autoplay stays longer on a chart
      data-story-chart
    >
      {/* The axis column is as wide as its label or counts, whichever is
          wider, so a long label in another language never spills out */}
      <div className='grid grid-cols-[auto_1fr] gap-x-2'>
        {/* Clear of the top count, which sits half above the plot */}
        <p className='mb-4 text-right text-xs whitespace-nowrap text-neutral-500'>
          {axisLabel}
        </p>
        <div aria-hidden />

        <div className='relative h-56 min-w-8 sm:h-40'>
          {ticks.map((tick) => (
            <span
              key={tick}
              className='absolute right-0 translate-y-1/2 text-xs whitespace-nowrap text-neutral-500 tabular-nums'
              style={{ bottom: `${(tick / niceMax) * 100}%` }}
            >
              {format.number(tick)}
            </span>
          ))}
        </div>

        <div className='relative flex-1'>
          {ticks.map((tick) => (
            <span
              key={tick}
              className='absolute inset-x-0 border-t border-white/10'
              style={{ bottom: `${(tick / niceMax) * 100}%` }}
            />
          ))}

          <div className='relative flex h-56 items-end gap-0.5 sm:h-40 sm:gap-1'>
            {data.map((value, index) => {
              const isPeak = index === peakIndex
              const heightPercentage =
                value > 0 ? Math.max((value / niceMax) * 100, 2) : 0

              return (
                <div
                  key={index}
                  className='flex h-full min-w-0 flex-1 items-end'
                >
                  <motion.div
                    className={clsx(
                      'w-full origin-bottom rounded-t-sm',
                      isPeak ? 'bg-plex' : 'bg-white/20',
                    )}
                    style={{ height: `${heightPercentage}%` }}
                    initial={shouldReduceMotion ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={
                      shouldReduceMotion
                        ? instantTransition
                        : {
                            delay: index * 0.025,
                            duration: 0.5,
                            ease: 'easeOut',
                          }
                    }
                  />
                </div>
              )
            })}
          </div>
        </div>

        {labels && (
          <>
            <div aria-hidden />
            <div className='relative mt-2 h-4'>
              <BarLabels
                labels={labels}
                peakIndex={peakIndex}
                className={wideLabels && 'sm:hidden'}
              />
              {wideLabels && (
                <BarLabels
                  labels={wideLabels}
                  peakIndex={peakIndex}
                  className='max-sm:hidden'
                />
              )}
            </div>
            {yearLabels && (
              <>
                <div aria-hidden />
                <SpanLabels labels={yearLabels} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
