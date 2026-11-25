'use client'

import MultiSelect from '@/components/MultiSelect'
import { EmailSettings, SettingsFormInitialState } from '@/types/settings'
import {
  EMAIL_SECURITIES,
  LOCALES,
  NEWSLETTER_FREQUENCIES,
  NEWSLETTER_SECTIONS,
  NewsletterFrequency,
} from '@/utils/constants'
import type { EmailRecipient } from '@/utils/emailRecipients'
import { getLocaleName } from '@/utils/localeName'
import type { NewsletterRun } from '@/utils/newsletter'
import { getNextSendTime, MAX_MONTH_DAY } from '@/utils/newsletterSchedule'
import { useFormatter, useTranslations } from 'next-intl'
import { useActionState, useState, useSyncExternalStore } from 'react'
import { Switch } from 'react-aria-components'
import SettingsForm from '../../_components/SettingsForm'
import { sendNewsletterToMe } from '../_actions/sendEmails'
import saveEmailSettings from '../_actions/updateEmailSettings'
import EmailTest from './EmailTest'
import EmailTryIt from './EmailTryIt'
import EmailUsers from './EmailUsers'

export type EmailFormSettings = Omit<
  EmailSettings,
  'addresses' | 'unsubscribed'
>

type Props = {
  // With the password masked
  settings: EmailFormSettings
  recipients: Promise<EmailRecipient[] | null>
  // The address set for the app, which the emails use unless another is set
  siteUrl: string
  // Off when users see only their own stats, which leaves out the server's
  isOthersShown: boolean
  lastRun: NewsletterRun | null
  adminAddress: string
  adminId: string
  // The server's, which the newsletter's hour is in
  timeZone: string
  // ISO 8601, when the page was made, which the next send is worked out from,
  // so the server's render and the browser's agree
  now: string
}

type EmailFormState = SettingsFormInitialState<Partial<EmailSettings>>

// 4 January 2026 was a Sunday, so day 0 of the week
const SUNDAY = new Date(2026, 0, 4)
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const WEEKDAYS = Array.from({ length: 7 }, (_, day) => day)
const MONTH_DAYS = Array.from({ length: MAX_MONTH_DAY }, (_, day) => day + 1)

function subscribe() {
  return () => {}
}

function getOrigin() {
  return window.location.origin
}

export default function EmailSettingsForm({
  settings,
  recipients,
  siteUrl,
  isOthersShown,
  lastRun,
  adminAddress,
  adminId,
  timeZone,
  now,
}: Props) {
  const t = useTranslations('Settings.Email')
  const tCommon = useTranslations('Common')
  const format = useFormatter()
  const initialState: EmailFormState = {
    message: '',
    status: '',
    fields: settings,
  }
  const [formState, formAction] = useActionState<EmailFormState, FormData>(
    saveEmailSettings,
    initialState,
  )
  const emailSettings = { ...settings, ...formState.fields }
  const [isNewsletterActive, setIsNewsletterActive] = useState(
    settings.isNewsletterActive,
  )
  const [frequency, setFrequency] = useState<NewsletterFrequency>(
    settings.newsletterFrequency,
  )
  const [weekday, setWeekday] = useState(settings.newsletterWeekday)
  const [monthDay, setMonthDay] = useState(settings.newsletterMonthDay)
  const [hour, setHour] = useState(settings.newsletterHour)
  // As picked, before it's saved, in the server's time zone like the schedule
  const nextSendTime = getNextSendTime(
    {
      isNewsletterActive: true,
      newsletterFrequency: frequency,
      newsletterWeekday: weekday,
      newsletterMonthDay: monthDay,
      newsletterHour: hour,
    },
    new Date(now),
    timeZone,
  )
  // The address the admin opened the settings from, until another is saved
  const origin = useSyncExternalStore(subscribe, getOrigin, () => '')
  const appUrl = emailSettings.appUrl || (siteUrl ? '' : origin)
  const sectionOptions = NEWSLETTER_SECTIONS.map((section) => ({
    value: section,
    label: t(`sections.${section}`),
  }))

  return (
    <SettingsForm formState={formState} formAction={formAction}>
      <section className='group-settings group'>
        <h2 className='heading-settings'>{t('mailServer')}</h2>
        <label className='input-wrapper'>
          <input
            key={`smtp-host-${emailSettings.smtpHost}`}
            type='text'
            className='input'
            name='smtpHost'
            placeholder='smtp.example.com'
            defaultValue={emailSettings.smtpHost}
            autoComplete='off'
          />
          <span className='label'>
            <span className='label-wrapper'>{t('host')}</span>
          </span>
        </label>
        <label className='input-wrapper'>
          <input
            key={`smtp-port-${emailSettings.smtpPort}`}
            type='number'
            className='input'
            name='smtpPort'
            min={1}
            max={65535}
            required
            defaultValue={emailSettings.smtpPort}
          />
          <span className='label'>
            <span className='label-wrapper'>{t('port')}</span>
          </span>
        </label>
        <label className='input-wrapper'>
          <span className='select-wrapper'>
            <select
              key={`smtp-security-${emailSettings.smtpSecurity}`}
              className='input'
              name='smtpSecurity'
              defaultValue={emailSettings.smtpSecurity}
            >
              {EMAIL_SECURITIES.map((security) => (
                <option key={security} value={security}>
                  {t(`securities.${security}`)}
                </option>
              ))}
            </select>
          </span>
          <span className='label'>
            <span className='label-wrapper'>{t('security')}</span>
          </span>
        </label>
        <label className='input-wrapper'>
          <input
            key={`smtp-user-${emailSettings.smtpUser}`}
            type='text'
            className='input'
            name='smtpUser'
            defaultValue={emailSettings.smtpUser}
            autoComplete='off'
          />
          <span className='label'>
            <span className='label-wrapper'>{t('user')}</span>
          </span>
        </label>
        <label className='input-wrapper'>
          <input
            key={`smtp-password-${emailSettings.smtpPassword}`}
            type='password'
            className='input'
            name='smtpPassword'
            defaultValue={emailSettings.smtpPassword}
            autoComplete='new-password'
          />
          <span className='label'>
            <span className='label-wrapper'>{t('password')}</span>
          </span>
        </label>
        <label className='input-wrapper'>
          <input
            key={`from-address-${emailSettings.fromAddress}`}
            type='email'
            className='input'
            name='fromAddress'
            placeholder='rewindarr@example.com'
            defaultValue={emailSettings.fromAddress}
          />
          <span className='label'>
            <span className='label-wrapper'>{t('fromAddress')}</span>
          </span>
        </label>
        <label className='input-wrapper'>
          <input
            key={`from-name-${emailSettings.fromName}`}
            type='text'
            className='input'
            name='fromName'
            placeholder='Rewindarr'
            defaultValue={emailSettings.fromName}
          />
          <span className='label'>
            <span className='label-wrapper'>{t('fromName')}</span>
          </span>
        </label>
        <EmailTest defaultAddress={adminAddress} />
      </section>
      <section className='group-settings group'>
        <h2 className='heading-settings'>{t('emails')}</h2>
        <label className='input-wrapper'>
          <input
            key={`app-url-${appUrl}`}
            type='url'
            className='input'
            name='appUrl'
            placeholder={siteUrl || 'https://rewindarr.example.com'}
            defaultValue={appUrl}
          />
          <span className='label'>
            <span className='label-wrapper'>{t('appUrl')}</span>
            <small>{t('appUrlDescription')}</small>
          </span>
        </label>
        <label className='input-wrapper'>
          <span className='select-wrapper'>
            <select
              key={`locale-${emailSettings.locale}`}
              className='input'
              name='locale'
              defaultValue={emailSettings.locale}
            >
              {LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {getLocaleName(locale)}
                </option>
              ))}
            </select>
          </span>
          <span className='label'>
            <span className='label-wrapper'>{t('language')}</span>
          </span>
        </label>
      </section>
      <section className='group-settings group'>
        <h2 className='heading-settings'>{t('newsletter')}</h2>
        <Switch
          className='switch items-start'
          name='isNewsletterActive'
          isSelected={isNewsletterActive}
          onChange={setIsNewsletterActive}
        >
          <div className='indicator' />
          <span className='label'>
            <span className='label-wrapper'>{tCommon('enabled')}</span>
            <small>{t('newsletterDescription')}</small>
          </span>
        </Switch>
        {isNewsletterActive && (
          <>
            <label className='input-wrapper'>
              <span className='select-wrapper'>
                <select
                  className='input'
                  name='newsletterFrequency'
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as NewsletterFrequency)
                  }
                >
                  {NEWSLETTER_FREQUENCIES.map((option) => (
                    <option key={option} value={option}>
                      {t(`frequencies.${option}`)}
                    </option>
                  ))}
                </select>
              </span>
              <span className='label'>
                <span className='label-wrapper'>{t('frequency')}</span>
                <small>{t(`frequencyDescriptions.${frequency}`)}</small>
              </span>
            </label>
            {frequency === 'weekly' && (
              <label className='input-wrapper'>
                <span className='select-wrapper'>
                  <select
                    className='input'
                    name='newsletterWeekday'
                    value={weekday}
                    onChange={(e) => setWeekday(Number(e.target.value))}
                  >
                    {WEEKDAYS.map((day) => (
                      <option key={day} value={day}>
                        {format.dateTime(
                          new Date(
                            SUNDAY.getFullYear(),
                            SUNDAY.getMonth(),
                            SUNDAY.getDate() + day,
                          ),
                          { weekday: 'long' },
                        )}
                      </option>
                    ))}
                  </select>
                </span>
                <span className='label'>
                  <span className='label-wrapper'>{t('weekday')}</span>
                </span>
              </label>
            )}
            {frequency !== 'weekly' && (
              <label className='input-wrapper'>
                <span className='select-wrapper'>
                  <select
                    className='input'
                    name='newsletterMonthDay'
                    value={monthDay}
                    onChange={(e) => setMonthDay(Number(e.target.value))}
                  >
                    {MONTH_DAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </span>
                <span className='label'>
                  <span className='label-wrapper'>{t('monthDay')}</span>
                </span>
              </label>
            )}
            <label className='input-wrapper'>
              <span className='select-wrapper'>
                <select
                  className='input'
                  name='newsletterHour'
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {format.dateTime(new Date(2026, 0, 1, hour), {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </option>
                  ))}
                </select>
              </span>
              <span className='label'>
                <span className='label-wrapper'>{t('hour')}</span>
                {/* The server's, which the schedule runs in */}
                <small>{timeZone}</small>
              </span>
            </label>
            {/* As picked, so it's clear when it goes out once saved */}
            <div className='grid gap-1 text-sm sm:pl-50'>
              <p className='text-neutral-300'>
                {t('nextSend', {
                  date: format.dateTime(nextSendTime, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone,
                  }),
                })}
              </p>
              {lastRun && (
                <p
                  className={
                    lastRun.error || lastRun.failed
                      ? 'text-danger'
                      : 'text-neutral-400'
                  }
                >
                  {lastRun.error
                    ? t('lastRunError', {
                        date: format.dateTime(new Date(lastRun.at), {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }),
                        error: t(lastRun.error),
                      })
                    : t('lastRun', {
                        date: format.dateTime(new Date(lastRun.at), {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }),
                        sent: lastRun.sent,
                        failed: lastRun.failed,
                        skipped: lastRun.skipped,
                      })}
                </p>
              )}
            </div>
            <MultiSelect
              key={`sections-${emailSettings.newsletterSections.join(',')}`}
              label={t('sectionsLabel')}
              description={isOthersShown ? undefined : t('sectionsOwnOnly')}
              name='newsletterSections'
              options={sectionOptions}
              defaultValue={emailSettings.newsletterSections}
              placeholder={tCommon('none')}
            />
            <div className='sm:pl-50'>
              <EmailTryIt
                previewHref={`/api/settings/email-preview?${new URLSearchParams({ type: 'newsletter', userId: adminId })}`}
                send={sendNewsletterToMe}
              />
            </div>
          </>
        )}
      </section>
      {/* Apart from the newsletter, as every email goes to these addresses */}
      <section className='group-settings group'>
        <h2 className='heading-settings'>{t('recipients')}</h2>
        <EmailUsers
          recipients={recipients}
          isNewsletterActive={isNewsletterActive}
          isNewsletterOnLoad={settings.isNewsletterActive}
        />
      </section>
    </SettingsForm>
  )
}
