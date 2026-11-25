'use client'

import type { EmailRecipient } from '@/utils/emailRecipients'
import { useTranslations } from 'next-intl'
import { Suspense, use } from 'react'
import { Switch } from 'react-aria-components'
import UserSearchList from '../../_components/UserSearchList'
import {
  ADDRESS_FIELD_PREFIX,
  LISTED_USERS_FIELD,
  SUBSCRIBED_FIELD,
  WAS_SUBSCRIBED_FIELD,
} from '../_actions/emailForm'

type Props = {
  // Read while the rest of the form shows. Null when they couldn't be read.
  recipients: Promise<EmailRecipient[] | null>
  // Each save sends a new list, which the fields start over from
  formKey: string
}

function RecipientList({ recipients: request, formKey }: Props) {
  const t = useTranslations('Settings.Email')
  const recipients = use(request)

  if (!recipients) {
    return (
      <p className='text-danger text-xs' role='alert'>
        {t('recipientsError')}
      </p>
    )
  }

  return (
    <UserSearchList
      users={recipients}
      searchLabel={t('recipientsSearch')}
      emptyLabel={t('recipientsNone')}
    >
      {(recipient) => (
        <>
          <input type='hidden' name={LISTED_USERS_FIELD} value={recipient.id} />
          {recipient.isSubscribed && (
            <input
              type='hidden'
              name={WAS_SUBSCRIBED_FIELD}
              value={recipient.id}
            />
          )}
          {/* Under the name on phones, beside it on wider screens */}
          <input
            key={`address-${formKey}-${recipient.customAddress}`}
            type='email'
            className='input order-last sm:order-none sm:w-64'
            name={`${ADDRESS_FIELD_PREFIX}${recipient.id}`}
            defaultValue={recipient.customAddress}
            placeholder={recipient.foundAddress || t('noAddress')}
            aria-label={t('addressLabel', { name: recipient.name })}
            autoComplete='off'
          />
          <Switch
            key={`subscribed-${formKey}-${recipient.isSubscribed}`}
            className='switch switch--small'
            name={SUBSCRIBED_FIELD}
            value={recipient.id}
            defaultSelected={recipient.isSubscribed}
            aria-label={t('subscribedLabel', { name: recipient.name })}
          >
            <div className='indicator' />
          </Switch>
        </>
      )}
    </UserSearchList>
  )
}

// Each user's address, and whether they get the newsletter. Saved with the
// form.
export default function EmailRecipients(props: Props) {
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
