'use client'

import DatePicker from '@/components/DatePicker'
import { STAT_ICONS } from '@/components/icons'
import MultiSelect from '@/components/MultiSelect'
import {
  DashboardSettings,
  PublicSettings,
  SettingsFormInitialState,
} from '@/types/settings'
import { HashtagIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { Switch } from 'react-aria-components'
import SettingsForm from '../../_components/SettingsForm'
import saveDashboardSettings from '../_actions/updateDashboardSettings'

type Props = {
  settings: PublicSettings
}

type DashboardFormState = SettingsFormInitialState<Partial<DashboardSettings>>

export default function DashboardSettingsForm({ settings }: Props) {
  const isSeerrActive = settings.connection.isSeerrActive
  const t = useTranslations('Settings.Dashboard')
  const tCommon = useTranslations('Common')
  // In the order they show on the dashboard
  const totalStatisticOptions = [
    {
      value: 'duration',
      label: tCommon('duration'),
      icon: <STAT_ICONS.duration />,
    },
    ...(isSeerrActive
      ? [
          {
            value: 'requests',
            label: tCommon('requests'),
            icon: <STAT_ICONS.requests />,
          },
        ]
      : []),
    { value: 'count', label: tCommon('count'), icon: <HashtagIcon /> },
    { value: 'size', label: tCommon('size'), icon: <STAT_ICONS.size /> },
  ]
  const [isActive, setIsActive] = useState<boolean>(settings.dashboard.isActive)
  const initialState: DashboardFormState = {
    message: '',
    status: '',
    fields: {
      ...settings.dashboard,
    },
  }
  const [formState, formAction] = useActionState<DashboardFormState, FormData>(
    saveDashboardSettings,
    initialState,
  )
  const dashboardSettings = {
    ...settings.dashboard,
    ...formState.fields,
  }

  return (
    <SettingsForm
      formState={formState}
      formAction={formAction}
      isSetup={!dashboardSettings.complete}
    >
      <section className='group-settings group'>
        <h2 className='heading-settings'>{tCommon('status')}</h2>
        <Switch
          className='switch'
          name='isActive'
          isSelected={isActive}
          onChange={setIsActive}
        >
          <div className='indicator'></div>
          <span className='label'>
            <span className='label-wrapper'>{tCommon('enabled')}</span>
          </span>
        </Switch>
        {isActive && (
          <>
            <Switch
              key={`users-page-${dashboardSettings.isUsersPageActive}`}
              className='switch'
              name='isUsersPageActive'
              defaultSelected={dashboardSettings.isUsersPageActive}
            >
              <div className='indicator'></div>
              <span className='label'>
                <span className='label-wrapper'>{t('usersPage')}</span>
              </span>
            </Switch>
            <Switch
              key={`admin-only-${dashboardSettings.isAdminOnly}`}
              className='switch items-start'
              name='isAdminOnly'
              defaultSelected={dashboardSettings.isAdminOnly}
            >
              <div className='indicator'></div>
              <span className='label'>
                <span className='label-wrapper'>{tCommon('adminOnly')}</span>
              </span>
            </Switch>
          </>
        )}
      </section>
      {isActive && (
        <>
          <section className='group-settings group'>
            <h2 className='heading-settings'>{t('statistics')}</h2>
            <MultiSelect
              key={`total-stats-${dashboardSettings.activeTotalStatistics.join(
                ',',
              )}`}
              label={t('totals')}
              name='activeTotalStatistics'
              options={totalStatisticOptions}
              defaultValue={dashboardSettings.activeTotalStatistics}
              placeholder={tCommon('none')}
            />
          </section>
          <section className='group-settings group'>
            <h2 className='heading-settings'>{tCommon('defaults')}</h2>
            <label className='input-wrapper'>
              <input
                key={`custom-period-${dashboardSettings.customPeriod}`}
                type='number'
                className='input'
                name='customPeriod'
                defaultValue={dashboardSettings.customPeriod}
                placeholder='30'
                min='1'
                max='3000'
                required
              />
              <span className='label'>
                <span className='label-wrapper'>{t('customPeriod')}</span>
                <small>{t('inDays')}</small>
              </span>
            </label>
            <DatePicker
              key={`start-date-${dashboardSettings.startDate}`}
              label={tCommon('startDate')}
              helperText={t('startDateHelperText')}
              name='startDate'
              defaultValue={dashboardSettings.startDate}
            />
          </section>
        </>
      )}
    </SettingsForm>
  )
}
