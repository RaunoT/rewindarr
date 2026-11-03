'use server'

import { denySettingsAccess } from '@/lib/access'
import { HistorySettings, SettingsFormInitialState } from '@/types/settings'
import { z } from 'zod'
import updateSettings from '../../_actions/updateSettings'

const schema = z.object({
  isActive: z.boolean(),
  isAdminOnly: z.boolean().optional(),
  complete: z.boolean(),
})

export default async function saveHistorySettings(
  prevState: SettingsFormInitialState<Partial<HistorySettings>>,
  formData: FormData,
) {
  const denied = await denySettingsAccess(prevState)

  if (denied) {
    return denied
  }

  const isActive = formData.get('isActive') === 'on'
  const data: Partial<HistorySettings> = {
    isActive,
    complete: true,
  }

  if (isActive) {
    data.isAdminOnly = formData.get('isAdminOnly') === 'on'
  }

  return await updateSettings(schema, data, 'history')
}
