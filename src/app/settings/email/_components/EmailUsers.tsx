'use client'

import SelectionActions from '@/components/SelectionActions'
import type { EmailRecipient } from '@/utils/emailRecipients'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { Suspense, use, useRef, useState } from 'react'
import { Switch } from 'react-aria-components'
import { useLoadedFields } from '../../_components/SettingsForm'
import UserSearchList from '../../_components/UserSearchList'
import {
  ADDRESS_FIELD_PREFIX,
  ADDRESS_USERS_FIELD,
  SUBSCRIBED_FIELD,
  SUBSCRIPTION_USERS_FIELD,
  WAS_SUBSCRIBED_FIELD,
} from '../_actions/emailForm'

type Props = {
  // Read while the rest of the form shows. Null when they couldn't be read.
  recipients: Promise<EmailRecipient[] | null>
  // Each save sends a new list, which the fields start over from
  formKey: string
  // As picked, which the newsletter's column shows for
  isNewsletterActive: boolean
  // Whether the newsletter was on when the form showed, rather than turned
  // on since
  isNewsletterOnLoad: boolean
}

function getSubscribed(recipients: EmailRecipient[] | null): string[] {
  return (
    recipients
      ?.filter((recipient) => recipient.isSubscribed)
      .map(({ id }) => id) ?? []
  )
}

type FieldsProps = {
  recipients: EmailRecipient[]
  subscribed: string[]
  isShownOnLoad: boolean
}

// Who gets the newsletter, as fields of their own, which the switches, select
// all and clear add and remove, so the form sees them as changes. Apart from
// the addresses, as these only count as loaded when the newsletter was on.
function SubscriptionFields({
  recipients,
  subscribed,
  isShownOnLoad,
}: FieldsProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLoadedFields(ref, isShownOnLoad)

  return (
    <div ref={ref} hidden>
      {recipients.map((recipient) => (
        <input
          key={recipient.id}
          type='hidden'
          name={SUBSCRIPTION_USERS_FIELD}
          value={recipient.id}
        />
      ))}
      {recipients
        .filter((recipient) => recipient.isSubscribed)
        .map((recipient) => (
          <input
            key={recipient.id}
            type='hidden'
            name={WAS_SUBSCRIBED_FIELD}
            value={recipient.id}
          />
        ))}
      {recipients
        .filter((recipient) => subscribed.includes(recipient.id))
        .map((recipient) => (
          <input
            key={recipient.id}
            type='hidden'
            name={SUBSCRIBED_FIELD}
            value={recipient.id}
          />
        ))}
    </div>
  )
}

function UserList({
  recipients: request,
  formKey,
  isNewsletterActive,
  isNewsletterOnLoad,
}: Props) {
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

  useLoadedFields(ref)

  if (!recipients) {
    return (
      <p className='text-danger text-xs' role='alert'>
        {t('recipientsError')}
      </p>
    )
  }

  return (
    <>
      <div ref={ref}>
        <UserSearchList
          users={recipients}
          searchLabel={t('recipientsSearch')}
          emptyLabel={t('recipientsNone')}
          header={
            // The controls have their own labels. Without the room for the
            // address beside the name it goes under it, so there's only the
            // newsletter's to name.
            <div
              className={clsx(
                'flex items-center gap-3 border-b border-white/10 px-3 py-2 text-xs font-medium text-neutral-400',
                !isNewsletterActive && '@max-lg:hidden',
              )}
              aria-hidden
            >
              <span className='min-w-0 flex-1'>{t('userColumn')}</span>
              <span className='w-56 @max-lg:hidden'>{t('addressColumn')}</span>
              {isNewsletterActive && (
                <span className='text-right @lg:w-20'>{t('newsletter')}</span>
              )}
            </div>
          }
          footer={
            isNewsletterActive && (
              <SelectionActions
                options={recipients.map(({ id }) => id)}
                value={subscribed}
                onChange={setSubscribed}
              />
            )
          }
        >
          {(recipient) => (
            <>
              <input
                type='hidden'
                name={ADDRESS_USERS_FIELD}
                value={recipient.id}
              />
              {/* Beside the name where the list has the room, else under it */}
              <input
                key={`address-${formKey}-${recipient.customAddress}`}
                type='email'
                className='input order-last text-sm @lg:order-none @lg:w-56'
                name={`${ADDRESS_FIELD_PREFIX}${recipient.id}`}
                defaultValue={recipient.customAddress}
                placeholder={recipient.foundAddress || t('noAddress')}
                aria-label={t('addressLabel', { name: recipient.name })}
                autoComplete='off'
              />
              {isNewsletterActive && (
                <div className='flex justify-end @lg:w-20'>
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
                </div>
              )}
            </>
          )}
        </UserSearchList>
      </div>
      {isNewsletterActive && (
        <SubscriptionFields
          recipients={recipients}
          subscribed={subscribed}
          isShownOnLoad={isNewsletterOnLoad}
        />
      )}
    </>
  )
}

// Where each user's emails go, and while the newsletter is on, who gets it.
// Saved with the form. Users can also stop the newsletter from a link in each
// one.
export default function EmailUsers(props: Props) {
  const t = useTranslations('Settings.Email')

  return (
    <div className='input-wrapper'>
      <div className='min-w-0 flex-1'>
        <Suspense
          fallback={<p className='text-sm text-neutral-400'>{t('loading')}</p>}
        >
          <UserList {...props} />
        </Suspense>
      </div>
      <span className='label label--start'>
        <span className='label-wrapper'>{t('users')}</span>
        {props.isNewsletterActive && (
          <small>{t('recipientsDescription')}</small>
        )}
      </span>
    </div>
  )
}
