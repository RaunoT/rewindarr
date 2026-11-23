'use client'

import { useState } from 'react'
import { Switch } from 'react-aria-components'

type Props = {
  isOwnOnly: boolean
  isOwnOnlyForAdmin: boolean
  label: string
  adminLabel: string
  adminDescription: string
}

// Signed-in users see only their own, and admins too when they ask for it
export default function OwnOnlySwitches({
  isOwnOnly: initialIsOwnOnly,
  isOwnOnlyForAdmin: initialIsOwnOnlyForAdmin,
  label,
  adminLabel,
  adminDescription,
}: Props) {
  const [isOwnOnly, setIsOwnOnly] = useState<boolean>(initialIsOwnOnly)
  // Kept while the switch is hidden, so turning it back on brings it back
  const [isOwnOnlyForAdmin, setIsOwnOnlyForAdmin] = useState<boolean>(
    initialIsOwnOnlyForAdmin,
  )

  return (
    <>
      <Switch
        className='switch'
        name='isOwnOnly'
        isSelected={isOwnOnly}
        onChange={setIsOwnOnly}
      >
        <div className='indicator'></div>
        <span className='label'>
          <span className='label-wrapper'>{label}</span>
        </span>
      </Switch>
      {isOwnOnly && (
        <Switch
          className='switch items-start'
          name='isOwnOnlyForAdmin'
          isSelected={isOwnOnlyForAdmin}
          onChange={setIsOwnOnlyForAdmin}
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
