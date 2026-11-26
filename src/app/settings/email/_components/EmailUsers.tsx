'use client'

import SelectionActions from '@/components/SelectionActions'
import type { EmailRecipient } from '@/utils/emailRecipients'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import {
  Dispatch,
  Fragment,
  SetStateAction,
  Suspense,
  use,
  useRef,
  useState,
} from 'react'
import { Switch } from 'react-aria-components'
import { useLoadedFields } from '../../_components/SettingsForm'
import UserSearchList from '../../_components/UserSearchList'
import {
  ADDRESS_FIELD_PREFIX,
  ADDRESS_USERS_FIELD,
  INVITE_USERS_FIELD,
  INVITED_FIELD,
  SUBSCRIBED_FIELD,
  SUBSCRIPTION_USERS_FIELD,
  WAS_INVITED_FIELD,
  WAS_SUBSCRIBED_FIELD,
} from '../_actions/emailForm'
import SendRewindButton, {
  getSendKey,
  useRewindSends,
} from './SendRewindButton'

type Props = {
  // Read while the rest of the form shows. Null when they couldn't be read.
  recipients: Promise<EmailRecipient[] | null>
  // As picked, which the newsletter's column shows for
  isNewsletterActive: boolean
  // Whether the newsletter was on when the form showed, rather than turned
  // on since
  isNewsletterOnLoad: boolean
  // The same for the Rewind invites on the release day
  isInviteActive: boolean
  isInviteOnLoad: boolean
  // Whether a user can be emailed their Rewind invite straight away
  canSendRewind: boolean
}

// A switch each user has, for an email they can stop
type SwitchColumn = {
  label: string
  getSwitchLabel: (name: string) => string
  // Who it's on for, as switched
  value: string[]
  onChange: Dispatch<SetStateAction<string[]>>
  // Whether it was on for a user when the form showed
  wasOn: (recipient: EmailRecipient) => boolean
  fields: { users: string; isOn: string; wasOn: string }
}

function getSubscribed(recipients: EmailRecipient[] | null): string[] {
  return (
    recipients
      ?.filter((recipient) => recipient.isSubscribed)
      .map(({ id }) => id) ?? []
  )
}

function getInvited(recipients: EmailRecipient[] | null): string[] {
  return (
    recipients
      ?.filter((recipient) => recipient.isInvited)
      .map(({ id }) => id) ?? []
  )
}

// Who a column's on for, as fields of their own, which the switches, select
// all and clear add and remove, so the form sees them as changes
function SwitchFields({
  column,
  recipients,
}: {
  column: SwitchColumn
  recipients: EmailRecipient[]
}) {
  return recipients.map((recipient) => (
    <Fragment key={recipient.id}>
      <input type='hidden' name={column.fields.users} value={recipient.id} />
      {column.wasOn(recipient) && (
        <input type='hidden' name={column.fields.wasOn} value={recipient.id} />
      )}
      {column.value.includes(recipient.id) && (
        <input type='hidden' name={column.fields.isOn} value={recipient.id} />
      )}
    </Fragment>
  ))
}

function UserList({
  recipients: request,
  isNewsletterActive,
  isNewsletterOnLoad,
  isInviteActive,
  isInviteOnLoad,
  canSendRewind,
}: Props) {
  const t = useTranslations('Settings.Email')
  const recipients = use(request)
  const ref = useRef<HTMLDivElement>(null)
  const subscriptionRef = useRef<HTMLDivElement>(null)
  const inviteRef = useRef<HTMLDivElement>(null)
  const [subscribed, setSubscribed] = useState(() => getSubscribed(recipients))
  const [invited, setInvited] = useState(() => getInvited(recipients))
  const [shownRecipients, setShownRecipients] = useState(recipients)
  const sends = useRewindSends()
  // Which read of the users the address fields show
  const [version, setVersion] = useState(0)

  // A save reads the users again, and the switches and address fields start
  // over from them, like the fields they're compared with. Someone who
  // unsubscribed meanwhile isn't subscribed again by the next save. A save
  // that fails reads nothing, so what was typed stays.
  if (recipients !== shownRecipients) {
    setShownRecipients(recipients)
    setSubscribed(getSubscribed(recipients))
    setInvited(getInvited(recipients))
    setVersion(version + 1)
  }

  useLoadedFields(ref)
  // The newsletter's fields only count as loaded when it was on as the form
  // showed, rather than turned on since
  useLoadedFields(subscriptionRef, isNewsletterOnLoad && isNewsletterActive)
  useLoadedFields(inviteRef, isInviteOnLoad && isInviteActive)

  if (!recipients) {
    return (
      <p className='text-danger text-xs' role='alert'>
        {t('recipientsError')}
      </p>
    )
  }

  const newsletterColumn: SwitchColumn = {
    label: t('newsletter'),
    getSwitchLabel: (name) => t('subscribedLabel', { name }),
    value: subscribed,
    onChange: setSubscribed,
    wasOn: (recipient) => recipient.isSubscribed,
    fields: {
      users: SUBSCRIPTION_USERS_FIELD,
      isOn: SUBSCRIBED_FIELD,
      wasOn: WAS_SUBSCRIBED_FIELD,
    },
  }
  const inviteColumn: SwitchColumn = {
    label: t('invite'),
    getSwitchLabel: (name) => t('invitedLabel', { name }),
    value: invited,
    onChange: setInvited,
    wasOn: (recipient) => recipient.isInvited,
    fields: {
      users: INVITE_USERS_FIELD,
      isOn: INVITED_FIELD,
      wasOn: WAS_INVITED_FIELD,
    },
  }
  const columns = [
    ...(isNewsletterActive ? [newsletterColumn] : []),
    ...(isInviteActive ? [inviteColumn] : []),
  ]
  const ids = recipients.map(({ id }) => id)
  // The address goes under the name sooner with more beside it: both
  // switches, or the button that sends a Rewind invite
  const isStacked = columns.length > 1 || canSendRewind
  // Select all and clear are for every switch, whichever column it's in
  const switchKeys = columns.flatMap((_, index) =>
    ids.map((id) => `${index}:${id}`),
  )
  const switchedKeys = columns.flatMap((column, index) =>
    column.value.map((id) => `${index}:${id}`),
  )

  function setSwitched(keys: string[]) {
    columns.forEach((column, index) => {
      const prefix = `${index}:`

      column.onChange(
        keys
          .filter((key) => key.startsWith(prefix))
          .map((key) => key.slice(prefix.length)),
      )
    })
  }

  return (
    <>
      <div ref={ref}>
        <UserSearchList
          users={recipients}
          searchLabel={t('recipientsSearch')}
          emptyLabel={t('recipientsNone')}
          footer={
            !!columns.length && (
              <fieldset
                className='min-w-0'
                aria-label={columns.map((column) => column.label).join(', ')}
              >
                <SelectionActions
                  options={switchKeys}
                  value={switchedKeys}
                  onChange={setSwitched}
                />
              </fieldset>
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
              <div
                className={clsx(
                  'order-last flex w-full items-center gap-2',
                  isStacked ? '@2xl:order-none' : '@lg:order-none @lg:w-56',
                  isStacked && (canSendRewind ? '@2xl:w-80' : '@2xl:w-56'),
                )}
              >
                <input
                  key={`address-${version}`}
                  type='email'
                  className='input min-w-0 flex-1 text-base sm:text-sm'
                  name={`${ADDRESS_FIELD_PREFIX}${recipient.id}`}
                  defaultValue={recipient.customAddress}
                  placeholder={recipient.foundAddress || t('noAddress')}
                  aria-label={t('addressLabel', { name: recipient.name })}
                  autoComplete='off'
                />
                {canSendRewind && (
                  <SendRewindButton
                    user={recipient}
                    state={sends.states[getSendKey(recipient)]}
                    onSend={() => sends.send(recipient)}
                  />
                )}
              </div>
              {/* Each with its label, beside the name where the list has the
                  room, else under it */}
              {!!columns.length && (
                <div className='flex flex-wrap gap-x-5 gap-y-2 @max-md:w-full'>
                  {columns.map((column) => (
                    <Switch
                      key={column.label}
                      className='switch switch--small flex-row text-xs'
                      isSelected={column.value.includes(recipient.id)}
                      onChange={(isSelected) =>
                        column.onChange((ids) =>
                          isSelected
                            ? [...ids, recipient.id]
                            : ids.filter((id) => id !== recipient.id),
                        )
                      }
                      aria-label={column.getSwitchLabel(recipient.name)}
                    >
                      <div className='indicator' />
                      <span aria-hidden>{column.label}</span>
                    </Switch>
                  ))}
                </div>
              )}
            </>
          )}
        </UserSearchList>
      </div>
      {/* Apart from the addresses, as each counts as loaded on its own terms */}
      <div ref={subscriptionRef} hidden>
        {isNewsletterActive && (
          <SwitchFields column={newsletterColumn} recipients={recipients} />
        )}
      </div>
      <div ref={inviteRef} hidden>
        {isInviteActive && (
          <SwitchFields column={inviteColumn} recipients={recipients} />
        )}
      </div>
    </>
  )
}

// Where each user's emails go, and while the newsletter or the Rewind invites
// are on, who gets them. Saved with the form. Users can also stop either from
// a link in each email.
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
        {(props.isNewsletterActive || props.isInviteActive) && (
          <small>{t('recipientsDescription')}</small>
        )}
        {props.canSendRewind && (
          <small className='mt-2'>{t('sendNowDescription')}</small>
        )}
      </span>
    </div>
  )
}
