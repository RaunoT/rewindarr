'use client'

import clsx from 'clsx'
import { ReactNode } from 'react'
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'

export type SegmentOption = {
  // Not empty, which react-aria can't tell from no key
  value: string
  label: string
  icon?: ReactNode
}

type Props = {
  // The control's name for screen readers
  label: string
  options: SegmentOption[]
  value: string
  onChange: (value: string) => void
  // Before the options, such as a sort icon
  icon?: ReactNode
  className?: string
}

// A choice of one with every option in sight, which the arrow keys move
// between like radio buttons
export default function SegmentedControl({
  label,
  options,
  value,
  onChange,
  icon,
  className,
}: Props) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode='single'
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const [key] = keys

        if (key !== undefined && key !== value) {
          onChange(String(key))
        }
      }}
      className={clsx('segmented', className)}
    >
      {icon}
      {options.map((option) => (
        <ToggleButton key={option.value} id={option.value} className='segment'>
          {option.icon}
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
