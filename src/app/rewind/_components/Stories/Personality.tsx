import { RewindStory } from '@/types/rewind'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { PERSONALITY_ICONS } from '../personalityIcons'
import PersonalityStatText from '../PersonalityStatText'
import RewindCat from '../RewindCat'
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
              <RewindCat icon={<SparklesIcon />}>{chunks}</RewindCat>
            ),
          })}
        </p>
      </RewindStat>

      <RewindStat step={1}>
        <p>
          <RewindCat icon={<Icon />}>
            {t(`types.${personality.type}.name`)}
          </RewindCat>
        </p>
        <p className='mt-2'>{t(`types.${personality.type}.description`)}</p>
      </RewindStat>

      <RewindStat step={2} noScale>
        <p>{t('earnedBy')}</p>
        <ul className='mt-2'>
          {personality.stats.map((stat, index) => (
            <li key={`${stat.type}-${index}`} className='my-2 last:my-0'>
              <PersonalityStatText stat={stat} />
            </li>
          ))}
        </ul>
      </RewindStat>
    </>
  )
}
