'use client'

import {
  HistorySettings,
  PublicSettings,
  SettingsFormInitialState,
} from '@/types/settings'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { Switch } from 'react-aria-components'
import SettingsForm from '../../_components/SettingsForm'
import saveHistorySettings from '../_actions/updateHistorySettings'

type Props = {
  settings: PublicSettings
}

type HistoryFormState = SettingsFormInitialState<Partial<HistorySettings>>

export default function HistorySettingsForm({ settings }: Props) {
  const [isActive, setIsActive] = useState<boolean>(settings.history.isActive)
  const tCommon = useTranslations('Common')
  const initialState: HistoryFormState = {
    message: '',
    status: '',
    fields: {
      ...settings.history,
    },
  }
  const [formState, formAction] = useActionState<HistoryFormState, FormData>(
    saveHistorySettings,
    initialState,
  )
  const historySettings = {
    ...settings.history,
    ...formState.fields,
  }

  return (
    <SettingsForm
      formState={formState}
      formAction={formAction}
      isSetup={!historySettings.complete}
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
          <Switch
            key={`admin-only-${historySettings.isAdminOnly}`}
            className='switch items-start'
            name='isAdminOnly'
            defaultSelected={historySettings.isAdminOnly}
          >
            <div className='indicator'></div>
            <span className='label'>
              <span className='label-wrapper'>{tCommon('adminOnly')}</span>
            </span>
          </Switch>
        )}
      </section>
    </SettingsForm>
  )
}
