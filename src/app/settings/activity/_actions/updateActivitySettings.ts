'use server'

import { denySettingsAccess } from '@/lib/access'
import { ActivitySettings, SettingsFormInitialState } from '@/types/settings'
import { z } from 'zod'
import updateSettings from '../../_actions/updateSettings'

const schema = z.object({
  isActive: z.boolean(),
  isAdminOnly: z.boolean().optional(),
  isOwnOnly: z.boolean().optional(),
  isOwnOnlyForAdmin: z.boolean().optional(),
  complete: z.boolean(),
})

export default async function saveActivitySettings(
  prevState: SettingsFormInitialState<Partial<ActivitySettings>>,
  formData: FormData,
) {
  const denied = await denySettingsAccess(prevState, 'activity')

  if (denied) {
    return denied
  }

  const isActive = formData.get('isActive') === 'on'
  const data: Partial<ActivitySettings> = {
    isActive,
    complete: true,
  }

  if (isActive) {
    data.isAdminOnly = formData.get('isAdminOnly') === 'on'
    data.isOwnOnly = formData.get('isOwnOnly') === 'on'

    if (data.isOwnOnly) {
      data.isOwnOnlyForAdmin = formData.get('isOwnOnlyForAdmin') === 'on'
    }
  }

  return await updateSettings(schema, data, 'activity')
}
