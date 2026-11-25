'use client'

import SelectionActions from '@/components/SelectionActions'
import type { EmailRecipient } from '@/utils/emailRecipients'
import { useTranslations } from 'next-intl'
import { Suspense, use, useRef, useState } from 'react'
import { Switch } from 'react-aria-components'
import { useLoadedFields } from '../../_components/SettingsForm'
import UserSearchList from '../../_components/UserSearchList'
import {
  SUBSCRIBED_FIELD,
  SUBSCRIPTION_USERS_FIELD,
  WAS_SUBSCRIBED_FIELD,
} from '../_actions/emailForm'

type Props = {
  recipients: Promise<EmailRecipient[] | null>
  // Whether the list showed with the form, rather than after the newsletter
  // was turned on
  isShownOnLoad: boolean
}

function getSubscribed(recipients: EmailRecipient[] | null): string[] {
  return (
    recipients
      ?.filter((recipient) => recipient.isSubscribed)
      .map(({ id }) => id) ?? []
  )
}

function RecipientList({ recipients: request, isShownOnLoad }: Props) {
  const t = useTranslations('Settings.Email')
  const recipients = use(request)
  const ref = useRef<HTMLDivElement>(null)
  const [subscribed, setSubscribed] = useState(() => getSubscribed(recipients))
  const [shownRecipients, setShownRecipients] = useState(recipients)

  // A save reads the users again, and the switches start over from them, like
  // the fields they're compared with. Someone who unsubscribed meanwhile
  // isn't subscribed again by the next save.
  if (recipients !== shownRecipients) {
    setShownRecipients(recipients)
    setSubscribed(getSubscribed(recipients))
  }

  useLoadedFields(ref, isShownOnLoad)

  if (!recipients) {
    return (
      <p className='text-danger text-xs' role='alert'>
        {t('recipientsError')}
      </p>
    )
  }

  return (
    <div ref={ref} className='grid gap-3'>
      <UserSearchList
        users={recipients}
        searchLabel={t('recipientsSearch')}
        emptyLabel={t('recipientsNone')}
      >
        {(recipient) => (
          <>
            <input
              type='hidden'
              name={SUBSCRIPTION_USERS_FIELD}
              value={recipient.id}
            />
            {recipient.isSubscribed && (
              <input
                type='hidden'
                name={WAS_SUBSCRIBED_FIELD}
                value={recipient.id}
              />
            )}
            {!recipient.address && (
              <span className='text-xs text-neutral-400'>{t('noAddress')}</span>
            )}
            {/* As a field of its own, which select all and clear add and
                remove, so the form sees them as changes */}
            {subscribed.includes(recipient.id) && (
              <input
                type='hidden'
                name={SUBSCRIBED_FIELD}
                value={recipient.id}
              />
            )}
            <Switch
              className='switch switch--small'
              isSelected={subscribed.includes(recipient.id)}
              onChange={(isSelected) =>
                setSubscribed((ids) =>
                  isSelected
                    ? [...ids, recipient.id]
                    : ids.filter((id) => id !== recipient.id),
                )
              }
              aria-label={t('subscribedLabel', { name: recipient.name })}
            >
              <div className='indicator' />
            </Switch>
          </>
        )}
      </UserSearchList>
      <SelectionActions
        options={recipients.map(({ id }) => id)}
        value={subscribed}
        onChange={setSubscribed}
      />
    </div>
  )
}

// Who gets the newsletter. Users can also stop it from a link in each one.
export default function NewsletterRecipients(props: Props) {
  const t = useTranslations('Settings.Email')

  return (
    <div className='input-wrapper'>
      <div className='min-w-0 flex-1'>
        <Suspense
          fallback={<p className='text-sm text-neutral-400'>{t('loading')}</p>}
        >
          <RecipientList {...props} />
        </Suspense>
      </div>
      <span className='label label--start'>
        <span className='label-wrapper'>{t('recipients')}</span>
        <small>{t('recipientsDescription')}</small>
      </span>
    </div>
  )
}
