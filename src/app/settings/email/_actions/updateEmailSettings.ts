'use server'

import { canManageEmail, denySettingsAccess } from '@/lib/access'
import { EmailSettings, SettingsFormInitialState } from '@/types/settings'
import {
  EMAIL_SECURITIES,
  LOCALES,
  NEWSLETTER_FREQUENCIES,
  NEWSLETTER_SECTIONS,
} from '@/utils/constants'
import { isWebUrl } from '@/utils/emailLinks'
import { isEmailAddress } from '@/utils/emailRecipients'
import getSettings, { writeSettings } from '@/utils/getSettings'
import {
  isMailServerSet,
  maskMailPassword,
  restoreMailPassword,
} from '@/utils/mailer'
import { passOverDueNewsletter } from '@/utils/newsletter'
import { isSameSchedule, MAX_MONTH_DAY } from '@/utils/newsletterSchedule'
import { passOverReleasedRewind } from '@/utils/rewindRelease'
import { canSendReleaseEmails } from '@/utils/rewindReleaseSchedule'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import updateSettings from '../../_actions/updateSettings'
import { INVITE_OFFERED_FIELD, readEmailForm } from './emailForm'

type EmailFormState = SettingsFormInitialState<Partial<EmailSettings>>

export default async function saveEmailSettings(
  prevState: EmailFormState,
  formData: FormData,
): Promise<EmailFormState> {
  const state = await validateAndSave(prevState, formData)

  return {
    ...state,
    fields: maskMailPassword(state.fields, getSettings().email),
  }
}

// Whether Rewind invites go out on the release day, which is one of Rewind's
// settings, as it's the release that sends them
async function saveInviteSwitch(isOn: boolean) {
  const settings = getSettings()

  if (
    !canSendReleaseEmails(settings) ||
    settings.rewind.isReleaseEmailActive === isOn
  ) {
    return
  }

  try {
    settings.rewind.isReleaseEmailActive = isOn
    writeSettings(settings)

    // An edition that's already out isn't emailed, only the next one
    if (isOn) {
      await passOverReleasedRewind(settings)
    }
  } catch (error) {
    console.error('[REWIND EMAILS] - Unable to save the invites!', error)
  }
}

async function validateAndSave(
  prevState: EmailFormState,
  formData: FormData,
): Promise<EmailFormState> {
  const denied = await denySettingsAccess(prevState, 'email')

  if (denied) {
    return denied
  }

  const t = await getTranslations('Settings.Email')

  if (!(await canManageEmail())) {
    return {
      message: (await getTranslations('Settings'))('genericError'),
      status: 'error',
      fields: prevState?.fields,
    }
  }

  const saved = getSettings().email
  const submitted = readEmailForm(formData, saved)
  const data = restoreMailPassword(
    submitted as Partial<EmailSettings> & EmailSettings,
    saved,
  )

  if (!data) {
    return {
      message: t('reenterPassword'),
      status: 'error',
      fields: submitted,
    }
  }

  // Without a user, the server takes mail without signing in
  if (!data.smtpUser) {
    data.smtpPassword = ''
  }

  if (data.isNewsletterActive && !isMailServerSet(data)) {
    return {
      message: t('newsletterNeedsMailServer'),
      status: 'error',
      fields: data,
    }
  }

  const schema = z.object({
    smtpHost: z.string(),
    smtpPort: z
      .number()
      .int()
      .min(1)
      .max(65535, { message: t('portError') }),
    smtpSecurity: z.enum(EMAIL_SECURITIES),
    smtpUser: z.string(),
    smtpPassword: z.string(),
    fromAddress: z.string().refine((value) => !value || isEmailAddress(value), {
      message: t('fromAddressError'),
    }),
    fromName: z.string(),
    appUrl: z.string().refine((value) => !value || isWebUrl(value), {
      message: t('appUrlError'),
    }),
    locale: z.enum(LOCALES as [string, ...string[]]),
    addresses: z
      .record(
        z.string(),
        z.string().refine(isEmailAddress, { message: t('addressError') }),
      )
      .optional(),
    unsubscribed: z.array(z.string()).optional(),
    inviteUnsubscribed: z.array(z.string()).optional(),
    isNewsletterActive: z.boolean(),
    newsletterFrequency: z.enum(NEWSLETTER_FREQUENCIES).optional(),
    newsletterWeekday: z.number().int().min(0).max(6).optional(),
    newsletterMonthDay: z.number().int().min(1).max(MAX_MONTH_DAY).optional(),
    newsletterHour: z.number().int().min(0).max(23).optional(),
    newsletterSections: z
      .array(z.enum(NEWSLETTER_SECTIONS))
      .min(1, { message: t('sectionsError') })
      .optional(),
    complete: z.boolean(),
  })
  const state = await updateSettings(schema, data, 'email')
  const updated = getSettings().email

  // Only sent while there's a release day to invite users on
  if (
    state.status === 'success' &&
    formData.get(INVITE_OFFERED_FIELD) === 'on'
  ) {
    await saveInviteSwitch(formData.get('isReleaseEmailActive') === 'on')
  }

  // The first one goes out at the next send time, not straight away
  if (
    state.status === 'success' &&
    updated.isNewsletterActive &&
    !isSameSchedule(saved, updated)
  ) {
    await passOverDueNewsletter(updated).catch((error) => {
      console.error('[NEWSLETTER] - Unable to save the schedule!', error)
    })
  }

  return state
}
