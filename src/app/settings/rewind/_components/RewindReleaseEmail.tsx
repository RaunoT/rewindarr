'use client'

import type { RewindEmailsRun } from '@/utils/rewindRelease'
import clsx from 'clsx'
import { useFormatter, useTranslations } from 'next-intl'
import { Switch } from 'react-aria-components'

export type ReleaseEmailStatus = {
  isMailServerSet: boolean
  // ISO 8601
  nextTime: string
  lastRun: RewindEmailsRun | null
  // The server's, which the time is in
  timeZone: string
}

type Props = ReleaseEmailStatus & {
  defaultSelected: boolean
}

// Invites everyone to their Rewind on the release day. Saved with the form.
export default function RewindReleaseEmail({
  defaultSelected,
  isMailServerSet,
  nextTime,
  lastRun,
  timeZone,
}: Props) {
  const t = useTranslations('Settings.Rewind')
  const tEmail = useTranslations('Settings.Email')
  const format = useFormatter()

  function formatDate(iso: string) {
    return format.dateTime(new Date(iso), {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    })
  }

  return (
    <Switch
      className='switch items-start'
      name='isReleaseEmailActive'
      defaultSelected={defaultSelected}
    >
      <div className='indicator' />
      <span className='label'>
        <span className='label-wrapper'>{t('releaseEmail')}</span>
        <small>
          {t('releaseEmailDescription', { date: formatDate(nextTime) })}
          {!isMailServerSet && (
            <span className='text-danger block'>
              {t('releaseEmailNeedsMail')}
            </span>
          )}
          {lastRun && (
            <span
              className={clsx(
                'block',
                (lastRun.error || lastRun.failed) && 'text-danger',
              )}
            >
              {lastRun.error
                ? tEmail('lastRunError', {
                    date: formatDate(lastRun.at),
                    error: tEmail(lastRun.error),
                  })
                : tEmail('lastRun', {
                    date: formatDate(lastRun.at),
                    sent: lastRun.sent,
                    failed: lastRun.failed,
                    skipped: lastRun.skipped,
                  })}
            </span>
          )}
        </small>
      </span>
    </Switch>
  )
}
