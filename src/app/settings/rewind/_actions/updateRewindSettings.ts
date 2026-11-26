'use server'

import { denySettingsAccess } from '@/lib/access'
import {
  RewindPeriodType,
  RewindSettings,
  SettingsFormInitialState,
} from '@/types/settings'
import {
  AUTOPLAY_SPEEDS,
  AutoplaySpeed,
  REWIND_STORIES,
  RewindStoryId,
} from '@/utils/constants'
import getSettings from '@/utils/getSettings'
import { FIRST_YEAR, isReleaseDate } from '@/utils/rewindPeriod'
import { passOverReleasedRewind } from '@/utils/rewindRelease'
import { isReleaseEmailOn } from '@/utils/rewindReleaseSchedule'
import { isCalendarDate } from '@/utils/timeZone'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import updateSettings from '../../_actions/updateSettings'

export default async function saveRewindSettings(
  prevState: SettingsFormInitialState<Partial<RewindSettings>>,
  formData: FormData,
) {
  const denied = await denySettingsAccess(prevState, 'rewind')

  if (denied) {
    return denied
  }

  const t = await getTranslations('Settings.Rewind')
  const schema = z
    .object({
      isActive: z.boolean(),
      isAdminOnly: z.boolean().optional(),
      isShareLoginRequired: z.boolean().optional(),
      hiddenStories: z.array(z.enum(REWIND_STORIES)).optional(),
      isThemeMusicActive: z.boolean().optional(),
      isSnowActive: z.boolean().optional(),
      isAutoplayActive: z.boolean().optional(),
      autoplaySpeed: z.enum(AUTOPLAY_SPEEDS).optional(),
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
      startDate: z
        .string()
        .refine((val) => !val || isCalendarDate(val), {
          message: t('startDateError'),
        })
        .optional(),
      complete: z.boolean(),
    })
    .superRefine((val, ctx) => {
      if (
        val.period === 'custom' &&
        (!val.startDate || !isCalendarDate(val.startDate))
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['startDate'],
          message: t('startDateError'),
        })
      }
    })
  const isActive = formData.get('isActive') === 'on'
  const data: Partial<RewindSettings> = {
    isActive,
    complete: true,
  }

  if (isActive) {
    data.isAdminOnly = formData.get('isAdminOnly') === 'on'

    // Only offered while users can open their own Rewind, which the links
    // lead to
    if (!data.isAdminOnly) {
      data.isShareLoginRequired = formData.get('isShareLoginRequired') === 'on'
    }

    data.hiddenStories = formData.getAll('hiddenStories') as RewindStoryId[]
    data.isThemeMusicActive = formData.get('isThemeMusicActive') === 'on'
    data.isSnowActive = formData.get('isSnowActive') === 'on'
    data.isAutoplayActive = formData.get('isAutoplayActive') === 'on'
    data.autoplaySpeed = formData.get('autoplaySpeed') as AutoplaySpeed
    data.period = formData.get('period') as RewindPeriodType
    // Only the custom period has a start date, so the others don't keep one
    data.startDate =
      data.period === 'custom' ? String(formData.get('startDate') ?? '') : ''

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

  const saved = getSettings().rewind
  const state = await updateSettings(schema, data, 'rewind')
  const updated = getSettings().rewind

  // An edition that's already out isn't emailed by a save that lets the
  // invites, turned on in the email settings, go out, or moves the release,
  // only the next one
  if (
    state.status === 'success' &&
    isReleaseEmailOn({ rewind: updated }) &&
    (!isReleaseEmailOn({ rewind: saved }) ||
      saved.releaseDate !== updated.releaseDate)
  ) {
    await passOverReleasedRewind({ rewind: updated }).catch((error) => {
      console.error('[REWIND EMAILS] - Unable to save the release!', error)
    })
  }

  return state
}
