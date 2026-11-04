import { RewindStory } from '@/types/rewind'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { motion } from 'motion/react'
import { useTranslations } from 'next-intl'
import { PERSONALITY_ICONS } from '../personalityIcons'
import PersonalityStatText from '../PersonalityStatText'
import RewindStat from '../RewindStat'

export default function StoryPersonality({ userRewind }: RewindStory) {
  const t = useTranslations('Rewind.Personality')
  const { personality } = userRewind

  if (!personality) {
    return null
  }

  const Icon = PERSONALITY_ICONS[personality.type]

  return (
    <>
      <RewindStat>
        <p>
          {t.rich('intro', {
            personality: (chunks) => (
              <span className='rewind-cat'>
                {chunks}
                <SparklesIcon />
              </span>
            ),
          })}
        </p>
      </RewindStat>

      <RewindStat step={1} noScale>
        {/* Pops in once the statement is up. Reduced motion leaves it still. */}
        <motion.span
          className='bg-plex/15 text-plex ring-plex/30 mb-3 flex size-14 items-center justify-center rounded-full ring-1 sm:mb-4 sm:size-20'
          initial={{ scale: 0.4, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', bounce: 0.5, delay: 0.25 }}
        >
          <Icon className='size-7 sm:size-10' />
        </motion.span>
        <p className='text-plex text-4xl font-semibold sm:text-5xl'>
          {t(`types.${personality.type}.name`)}
        </p>
        <p className='mt-2 text-lg leading-snug font-normal tracking-normal text-neutral-300 sm:text-2xl'>
          {t(`types.${personality.type}.description`)}
        </p>
      </RewindStat>

      <RewindStat step={2} noScale>
        <p className='mb-3 text-xl sm:text-2xl'>{t('earnedBy')}</p>
        <ul className='grid gap-2 text-base leading-snug font-normal tracking-normal sm:text-xl'>
          {personality.stats.map((stat, index) => (
            <li
              key={`${stat.type}-${index}`}
              className='rounded-2xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10 ring-inset sm:py-3'
            >
              <PersonalityStatText stat={stat} />
            </li>
          ))}
        </ul>
      </RewindStat>
    </>
  )
}
