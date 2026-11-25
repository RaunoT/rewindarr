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
import getSettings from '@/utils/getSettings'
import {
  isMailServerSet,
  maskMailPassword,
  restoreMailPassword,
} from '@/utils/mailer'
import { passOverDueNewsletter } from '@/utils/newsletter'
import { isSameSchedule } from '@/utils/newsletterSchedule'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import updateSettings from '../../_actions/updateSettings'
import { readEmailForm } from './emailForm'

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
    isNewsletterActive: z.boolean(),
    newsletterFrequency: z.enum(NEWSLETTER_FREQUENCIES).optional(),
    newsletterWeekday: z.number().int().min(0).max(6).optional(),
    newsletterHour: z.number().int().min(0).max(23).optional(),
    newsletterSections: z
      .array(z.enum(NEWSLETTER_SECTIONS))
      .min(1, { message: t('sectionsError') })
      .optional(),
    complete: z.boolean(),
  })
  const state = await updateSettings(schema, data, 'email')
  const updated = getSettings().email

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
