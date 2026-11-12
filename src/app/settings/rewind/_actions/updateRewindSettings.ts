'use server'

import { denySettingsAccess } from '@/lib/access'
import {
  RewindPeriodType,
  RewindSettings,
  SettingsFormInitialState,
} from '@/types/settings'
import { REWIND_STORIES, RewindStoryId } from '@/utils/constants'
import { FIRST_YEAR, isReleaseDate } from '@/utils/rewindPeriod'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import updateSettings from '../../_actions/updateSettings'

export default async function saveRewindSettings(
  prevState: SettingsFormInitialState<Partial<RewindSettings>>,
  formData: FormData,
) {
  const denied = await denySettingsAccess(prevState)

  if (denied) {
    return denied
  }

  const t = await getTranslations('Settings.Rewind')
  const schema = z.object({
    isActive: z.boolean(),
    isAdminOnly: z.boolean().optional(),
    hiddenStories: z.array(z.enum(REWIND_STORIES)).optional(),
    isThemeMusicActive: z.boolean().optional(),
    isSnowActive: z.boolean().optional(),
    period: z
      .enum(['calendarYear', 'pastYear', 'specificYear', 'custom'])
      .optional(),
    releaseDate: z
      .string()
      .refine(isReleaseDate, { message: t('releaseDateError') })
      .optional(),
    year: z
      .number()
      .refine(
        (year) =>
          Number.isInteger(year) &&
          year >= FIRST_YEAR &&
          year <= new Date().getFullYear(),
        { message: t('yearError') },
      )
      .optional(),
    startDate: z.string().optional(),
    complete: z.boolean(),
  })
  const isActive = formData.get('isActive') === 'on'
  const data: Partial<RewindSettings> = {
    isActive,
    complete: true,
  }

  if (isActive) {
    data.isAdminOnly = formData.get('isAdminOnly') === 'on'
    data.hiddenStories = formData.getAll('hiddenStories') as RewindStoryId[]
    data.isThemeMusicActive = formData.get('isThemeMusicActive') === 'on'
    data.isSnowActive = formData.get('isSnowActive') === 'on'
    data.period = formData.get('period') as RewindPeriodType
    // Only the custom period has a start date, so the others don't keep one
    data.startDate =
      data.period === 'custom' ? (formData.get('startDate') as string) : ''

    // The other periods keep the release date and the year for when they're
    // picked again
    // The picker's date has a year, which the release date leaves out
    if (data.period === 'calendarYear') {
      data.releaseDate = String(formData.get('releaseDate')).slice(5)
    }

    if (data.period === 'specificYear') {
      data.year = Number(formData.get('year'))
    }
  }

  return await updateSettings(schema, data, 'rewind')
}
