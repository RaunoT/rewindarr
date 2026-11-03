'use client'

import clsx from 'clsx'
import { ReactNode } from 'react'
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'

export type ChipOption = {
  value: string
  label: string
  icon?: ReactNode
}

type Props = {
  // The group's name for screen readers
  label: string
  options: ChipOption[]
  // Empty for all of them
  value: string[]
  onChange: (value: string[]) => void
  // The first chip, which stands for all of them and clears the others
  allLabel: string
  className?: string
}

const ALL = '__all'

// Any number of options, each a chip of its own
export default function ChipGroup({
  label,
  options,
  value,
  onChange,
  allLabel,
  className,
}: Props) {
  const selected = value.length ? value : [ALL]

  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode='multiple'
      selectedKeys={selected}
      onSelectionChange={(keys) => {
        const values = [...keys].map(String)
        const isAllPicked = values.includes(ALL) && !selected.includes(ALL)

        // Picking "all" clears the rest, and picking any other drops "all".
        // Dropping the last one picked leaves all of them.
        onChange(isAllPicked ? [] : values.filter((item) => item !== ALL))
      }}
      className={clsx('flex flex-wrap gap-2', className)}
    >
      <ToggleButton id={ALL} className='chip'>
        {allLabel}
      </ToggleButton>
      {options.map((option) => (
        <ToggleButton key={option.value} id={option.value} className='chip'>
          {option.icon}
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
