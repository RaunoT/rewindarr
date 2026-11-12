'use client'

import DatePicker from '@/components/DatePicker'
import { MEDIA_ICONS, STAT_ICONS } from '@/components/icons'
import MultiSelect from '@/components/MultiSelect'
import {
  PublicSettings,
  RewindPeriodType,
  RewindSettings,
  SettingsFormInitialState,
} from '@/types/settings'
import { REWIND_STORIES, RewindStoryId } from '@/utils/constants'
import { FIRST_YEAR, getRewindPeriodType } from '@/utils/rewindPeriod'
import {
  BackwardIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  ClockIcon,
  FingerPrintIcon,
  ForwardIcon,
  HeartIcon,
  PhotoIcon,
  SparklesIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { ComponentType, SVGProps, useActionState, useState } from 'react'
import { Switch } from 'react-aria-components'
import SettingsForm from '../../_components/SettingsForm'
import saveRewindSettings from '../_actions/updateRewindSettings'
import RewindMusicUpload from './RewindMusicUpload'
import RewindReleaseDate from './RewindReleaseDate'

type Props = {
  settings: PublicSettings
}

type RewindFormState = SettingsFormInitialState<Partial<RewindSettings>>

const PERIOD_TYPES: RewindPeriodType[] = [
  'calendarYear',
  'pastYear',
  'specificYear',
  'custom',
]
// Each story's own icon, where it has one
const STORY_ICONS: Record<
  RewindStoryId,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  total: ClockIcon,
  months: ChartBarIcon,
  year_over_year: BackwardIcon,
  shows: MEDIA_ICONS.show,
  shows_top: MEDIA_ICONS.show,
  shows_actors: UserIcon,
  shows_genres: TagIcon,
  movies: MEDIA_ICONS.movie,
  movies_top: MEDIA_ICONS.movie,
  movies_directors: VideoCameraIcon,
  movies_actors: UserIcon,
  movies_genres: TagIcon,
  audio: MEDIA_ICONS.artist,
  audio_top: MEDIA_ICONS.artist,
  comfort_watch: HeartIcon,
  time_travel: ClockIcon,
  discoveries: SparklesIcon,
  binge: ForwardIcon,
  biggest_day: CalendarIcon,
  habits_day: CalendarDaysIcon,
  habits_hour: ClockIcon,
  taste_match: UserIcon,
  only_you: FingerPrintIcon,
  users_top: UsersIcon,
  requests: STAT_ICONS.requests,
  requests_reach: STAT_ICONS.requests,
  server_year: UsersIcon,
  libraries: STAT_ICONS.size,
  first_play: CalendarIcon,
  personality: SparklesIcon,
  summary: PhotoIcon,
}
// Only told with Seerr
const REQUEST_STORIES: RewindStoryId[] = ['requests', 'requests_reach']

export default function RewindSettingsForm({ settings }: Props) {
  const [isActive, setIsActive] = useState<boolean>(settings.rewind.isActive)
  const [period, setPeriod] = useState<RewindPeriodType>(
    getRewindPeriodType(settings),
  )
  const t = useTranslations('Settings.Rewind')
  const tCommon = useTranslations('Common')
  const thisYear = new Date().getFullYear()
  const storyOptions = REWIND_STORIES.filter(
    (story) =>
      settings.connection.isSeerrActive || !REQUEST_STORIES.includes(story),
  ).map((story) => {
    const Icon = STORY_ICONS[story]

    return { value: story, label: t(`stories.${story}`), icon: <Icon /> }
  })
  const initialState: RewindFormState = {
    message: '',
    status: '',
    fields: {
      ...settings.rewind,
    },
  }
  const [formState, formAction] = useActionState<RewindFormState, FormData>(
    saveRewindSettings,
    initialState,
  )
  const rewindSettings = {
    ...settings.rewind,
    ...formState.fields,
  }

  return (
    <SettingsForm
      formState={formState}
      formAction={formAction}
      isSetup={!rewindSettings.complete}
    >
      <section className='group-settings group'>
        <h2 className='heading-settings'>{tCommon('status')}</h2>
        <Switch
          className='switch'
          name='isActive'
          isSelected={isActive}
          onChange={setIsActive}
        >
          <div className='indicator' />
          <span className='label'>
            <span className='label-wrapper'>{tCommon('enabled')}</span>
          </span>
        </Switch>
        {isActive && (
          <Switch
            key={`admin-only-${rewindSettings.isAdminOnly}`}
            className='switch items-start'
            name='isAdminOnly'
            defaultSelected={rewindSettings.isAdminOnly}
          >
            <div className='indicator' />
            <span className='label'>
              <span className='label-wrapper'>{tCommon('adminOnly')}</span>
            </span>
          </Switch>
        )}
      </section>
      {isActive && (
        <>
          <section className='group-settings group'>
            <h2 className='heading-settings'>{t('cards')}</h2>
            <MultiSelect
              key={`hidden-stories-${rewindSettings.hiddenStories.join(',')}`}
              label={t('hiddenStories')}
              name='hiddenStories'
              options={storyOptions}
              defaultValue={rewindSettings.hiddenStories}
              placeholder={tCommon('none')}
            />
            <Switch
              key={`snow-${rewindSettings.isSnowActive}`}
              className='switch'
              name='isSnowActive'
              defaultSelected={rewindSettings.isSnowActive}
            >
              <div className='indicator' />
              <span className='label'>
                <span className='label-wrapper'>{t('snow')}</span>
              </span>
            </Switch>
            <Switch
              key={`theme-music-${rewindSettings.isThemeMusicActive}`}
              className='switch items-start'
              name='isThemeMusicActive'
              defaultSelected={rewindSettings.isThemeMusicActive}
            >
              <div className='indicator' />
              <span className='label'>
                <span className='label-wrapper'>{t('themeMusic')}</span>
                <small>{t('themeMusicDescription')}</small>
              </span>
            </Switch>
            <RewindMusicUpload initialMusic={settings.rewind.music} />
          </section>
          <section className='group-settings group'>
            <h2 className='heading-settings'>{t('period')}</h2>
            <label className='input-wrapper'>
              <span className='select-wrapper'>
                <select
                  className='input'
                  name='period'
                  value={period}
                  onChange={(e) =>
                    setPeriod(e.target.value as RewindPeriodType)
                  }
                >
                  {PERIOD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`periods.${type}`)}
                    </option>
                  ))}
                </select>
              </span>
              <span className='label'>
                <span className='label-wrapper'>{t('covers')}</span>
                <small>{t(`periodDescriptions.${period}`)}</small>
              </span>
            </label>
            {period === 'calendarYear' && (
              <RewindReleaseDate
                key={`release-date-${rewindSettings.releaseDate}`}
                defaultValue={rewindSettings.releaseDate}
              />
            )}
            {period === 'specificYear' && (
              <label className='input-wrapper'>
                <input
                  key={`year-${rewindSettings.year}`}
                  type='number'
                  className='input'
                  name='year'
                  // Last year's is the one most likely to be over
                  defaultValue={rewindSettings.year ?? thisYear - 1}
                  min={FIRST_YEAR}
                  max={thisYear}
                  required
                />
                <span className='label'>
                  <span className='label-wrapper'>{tCommon('year')}</span>
                </span>
              </label>
            )}
            {period === 'custom' && (
              <DatePicker
                key={`start-date-${rewindSettings.startDate}`}
                label={tCommon('startDate')}
                name='startDate'
                defaultValue={rewindSettings.startDate}
                required
              />
            )}
          </section>
        </>
      )}
    </SettingsForm>
  )
}
