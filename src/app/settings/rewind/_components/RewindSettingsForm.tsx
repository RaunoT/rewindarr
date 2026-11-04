'use client'

import DatePicker from '@/components/DatePicker'
import {
  PublicSettings,
  RewindPeriodType,
  RewindSettings,
  SettingsFormInitialState,
} from '@/types/settings'
import { getRewindPeriodType } from '@/utils/rewindPeriod'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { Switch } from 'react-aria-components'
import SettingsForm from '../../_components/SettingsForm'
import saveRewindSettings from '../_actions/updateRewindSettings'
import RewindMusicUpload from './RewindMusicUpload'

type Props = {
  settings: PublicSettings
}

type RewindFormState = SettingsFormInitialState<Partial<RewindSettings>>

const PERIOD_TYPES: RewindPeriodType[] = ['pastYear', 'calendarYear', 'custom']

export default function RewindSettingsForm({ settings }: Props) {
  const [isActive, setIsActive] = useState<boolean>(settings.rewind.isActive)
  const [period, setPeriod] = useState<RewindPeriodType>(
    getRewindPeriodType(settings),
  )
  const t = useTranslations('Settings.Rewind')
  const tCommon = useTranslations('Common')
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
            <Switch
              key={`libraries-size-count-${rewindSettings.isLibrariesSizeAndCountActive}`}
              className='switch'
              name='isLibrariesSizeAndCountActive'
              defaultSelected={rewindSettings.isLibrariesSizeAndCountActive}
            >
              <div className='indicator' />
              <span className='label'>
                <span className='label-wrapper'>
                  {t('librariesSizeAndCountCard')}
                </span>
              </span>
            </Switch>
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
            <h2 className='heading-settings'>{tCommon('defaults')}</h2>
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
                <span className='label-wrapper'>{t('period')}</span>
                <small>{t(`periodDescriptions.${period}`)}</small>
              </span>
            </label>
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
