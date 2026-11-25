'use server'

import { denySettingsAccess } from '@/lib/access'
import {
  DashboardSettings,
  DashboardTotalStatistics,
  SettingsFormInitialState,
} from '@/types/settings'
import { isBuiltInPeriodLength } from '@/utils/getPeriod'
import { isCalendarDate } from '@/utils/timeZone'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import updateSettings from '../../_actions/updateSettings'

export default async function saveDashboardSettings(
  prevState: SettingsFormInitialState<Partial<DashboardSettings>>,
  formData: FormData,
) {
  const denied = await denySettingsAccess(prevState, 'dashboard')

  if (denied) {
    return denied
  }

  const t = await getTranslations('Settings.Dashboard')
  const schema = z.object({
    isActive: z.boolean(),
    isAdminOnly: z.boolean().optional(),
    isUsersPageActive: z.boolean().optional(),
    isOwnOnly: z.boolean().optional(),
    isOwnOnlyForAdmin: z.boolean().optional(),
    activeTotalStatistics: z
      .array(z.enum(['size', 'duration', 'count', 'requests']))
      .optional(),
    customPeriod: z
      .string()
      .refine(
        (value) => {
          const number = Number(value)

          return /^\d+$/.test(value) && number > 0 && number <= 3000
        },
        {
          message: t('customPeriodError'),
        },
      )
      // The period filter already has these, so they'd show twice
      .refine((value) => !isBuiltInPeriodLength(Number(value)), {
        message: t('customPeriodBuiltInError'),
      })
      .optional(),
    startDate: z
      .string()
      // Empty starts all time at the first play
      .refine((val) => !val || isCalendarDate(val), {
        message: t('startDateError'),
      })
      .optional(),
    complete: z.boolean(),
  })
  const isActive = formData.get('isActive') === 'on'
  const data: Partial<DashboardSettings> = {
    isActive,
    complete: true,
  }

  if (isActive) {
    data.isAdminOnly = formData.get('isAdminOnly') === 'on'
    data.isUsersPageActive = formData.get('isUsersPageActive') === 'on'
    data.isOwnOnly = formData.get('isOwnOnly') === 'on'

    if (data.isOwnOnly) {
      data.isOwnOnlyForAdmin = formData.get('isOwnOnlyForAdmin') === 'on'
    }

    data.activeTotalStatistics = formData.getAll(
      'activeTotalStatistics',
    ) as DashboardTotalStatistics
    data.customPeriod = formData.get('customPeriod') as string
    data.startDate = String(formData.get('startDate') ?? '')
  }

  return await updateSettings(schema, data, 'dashboard')
}
