'use client'

import SelectionActions from '@/components/SelectionActions'
import { toastQueue } from '@/components/Toasts'
import type { EmailRecipient } from '@/utils/emailRecipients'
import type { SendOutcome } from '@/utils/emailSend'
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  MinusCircleIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { Suspense, use, useState, useTransition } from 'react'
import { Checkbox } from 'react-aria-components'
import UserSearchList from '../../_components/UserSearchList'
import { sendRewind, sendRewindToMe } from '../_actions/sendEmails'
import EmailTryIt from './EmailTryIt'

type Props = {
  recipients: Promise<EmailRecipient[] | null>
  adminId: string
}

const OUTCOME_ICONS = {
  sent: CheckCircleIcon,
  failed: ExclamationCircleIcon,
  skipped: MinusCircleIcon,
}

function Outcome({ outcome }: { outcome: SendOutcome }) {
  const t = useTranslations('Settings.Email')
  const Icon = OUTCOME_ICONS[outcome.status]
  const reason =
    outcome.status === 'skipped' && outcome.reason
      ? t(`skipReasons.${outcome.reason}`)
      : outcome.reason
        ? t(outcome.reason)
        : null

  return (
    <p
      className={clsx(
        'order-last flex w-full items-start gap-1.5 pl-11 text-xs',
        outcome.status === 'failed' ? 'text-danger' : 'text-neutral-300',
      )}
    >
      <Icon
        className={clsx(
          'mt-px size-4 shrink-0',
          outcome.status === 'sent' && 'text-success',
        )}
        aria-hidden
      />
      {t(`outcomes.${outcome.status}`)}
      {reason && `: ${reason}`}
    </p>
  )
}

function RewindEmailList({ recipients: request }: Props) {
  const t = useTranslations('Settings.Email')
  const tSettings = useTranslations('Settings')
  const recipients = use(request)
  const [selected, setSelected] = useState<string[]>([])
  const [outcomes, setOutcomes] = useState<Map<string, SendOutcome>>(
    () => new Map(),
  )
  const [isPending, startTransition] = useTransition()

  if (!recipients) {
    return (
      <p className='text-danger text-xs' role='alert'>
        {t('recipientsError')}
      </p>
    )
  }

  const sendable = recipients
    .filter((recipient) => recipient.address)
    .map(({ id }) => id)

  function send() {
    startTransition(async () => {
      const result = await sendRewind(selected).catch(() => ({
        status: 'error' as const,
        message: tSettings('genericError'),
        outcomes: undefined,
      }))

      toastQueue.add(
        { message: result.message, status: result.status },
        // Errors stay until dismissed, so they can be read
        result.status === 'success' ? { timeout: 5000 } : undefined,
      )

      if (result.outcomes) {
        setOutcomes(
          new Map(result.outcomes.map((outcome) => [outcome.userId, outcome])),
        )
        // Those it went to aren't sent it again by accident
        setSelected((ids) =>
          ids.filter(
            (id) =>
              !result.outcomes?.some(
                (outcome) => outcome.userId === id && outcome.status === 'sent',
              ),
          ),
        )
      }
    })
  }

  return (
    <div className='grid gap-3'>
      <UserSearchList
        users={recipients}
        searchLabel={t('recipientsSearch')}
        emptyLabel={t('recipientsNone')}
      >
        {(recipient) => {
          const outcome = outcomes.get(recipient.id)

          return (
            <>
              {recipient.address ? (
                <span className='hidden max-w-56 truncate text-xs text-neutral-400 sm:block'>
                  {recipient.address}
                </span>
              ) : (
                <span className='text-xs text-neutral-400'>
                  {t('noAddress')}
                </span>
              )}
              {/* Not a setting, so it has no name and isn't saved */}
              <Checkbox
                className='checkbox-wrapper'
                isSelected={selected.includes(recipient.id)}
                isDisabled={!recipient.address || isPending}
                onChange={(isSelected) =>
                  setSelected((ids) =>
                    isSelected
                      ? [...ids, recipient.id]
                      : ids.filter((id) => id !== recipient.id),
                  )
                }
                aria-label={t('sendToLabel', { name: recipient.name })}
              >
                <div
                  className={clsx(
                    'checkbox',
                    !recipient.address && 'opacity-30',
                  )}
                  aria-hidden='true'
                />
              </Checkbox>
              {outcome && <Outcome outcome={outcome} />}
            </>
          )
        }}
      </UserSearchList>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <SelectionActions
          options={sendable}
          value={selected}
          onChange={setSelected}
        />
        <button
          type='button'
          className='button button-sm'
          onClick={send}
          disabled={isPending || !selected.length}
        >
          {isPending
            ? t('sending')
            : t('sendRewind', { count: selected.length })}
        </button>
      </div>
    </div>
  )
}

// Emails users a link to their Rewind. Sent straight away, apart from the
// form's save.
export default function RewindEmails(props: Props) {
  const t = useTranslations('Settings.Email')

  return (
    <>
      <div className='input-wrapper'>
        <div className='min-w-0 flex-1'>
          <Suspense
            fallback={
              <p className='text-sm text-neutral-400'>{t('loading')}</p>
            }
          >
            <RewindEmailList {...props} />
          </Suspense>
        </div>
        <span className='label label--start'>
          <span className='label-wrapper'>{t('rewindUsers')}</span>
          <small>{t('rewindUsersDescription')}</small>
        </span>
      </div>
      <EmailTryIt
        previewHref={`/api/settings/email-preview?${new URLSearchParams({ type: 'rewind', userId: props.adminId })}`}
        send={sendRewindToMe}
      />
    </>
  )
}
