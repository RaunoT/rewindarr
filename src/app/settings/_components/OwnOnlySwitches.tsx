'use client'

import { useState } from 'react'
import { Switch } from 'react-aria-components'

type Props = {
  isOwnOnly: boolean
  isOwnOnlyForAdmin: boolean
  label: string
  description: string
  adminLabel: string
  adminDescription: string
}

// Signed-in users see only their own, and admins too when they ask for it
export default function OwnOnlySwitches({
  isOwnOnly: initialIsOwnOnly,
  isOwnOnlyForAdmin,
  label,
  description,
  adminLabel,
  adminDescription,
}: Props) {
  const [isOwnOnly, setIsOwnOnly] = useState<boolean>(initialIsOwnOnly)

  return (
    <>
      <Switch
        className='switch items-start'
        name='isOwnOnly'
        isSelected={isOwnOnly}
        onChange={setIsOwnOnly}
      >
        <div className='indicator'></div>
        <span className='label'>
          <span className='label-wrapper'>{label}</span>
          <small>{description}</small>
        </span>
      </Switch>
      {isOwnOnly && (
        <Switch
          key={`own-only-admin-${isOwnOnlyForAdmin}`}
          className='switch items-start'
          name='isOwnOnlyForAdmin'
          defaultSelected={isOwnOnlyForAdmin}
        >
          <div className='indicator'></div>
          <span className='label'>
            <span className='label-wrapper'>{adminLabel}</span>
            <small>{adminDescription}</small>
          </span>
        </Switch>
      )}
    </>
  )
}
