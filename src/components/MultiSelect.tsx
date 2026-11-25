'use client'

import SelectionActions from '@/components/SelectionActions'
import { CheckIcon } from '@heroicons/react/24/outline'
import { ReactNode, useRef, useState } from 'react'
import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from 'react-aria-components'

export type MultiSelectOption = {
  value: string
  label: string
  icon?: ReactNode
}

type Props = {
  label: string
  description?: string
  // Each picked value is sent with the form under this name
  name: string
  options: MultiSelectOption[]
  defaultValue: string[]
  // Shown while nothing is picked
  placeholder: string
}

// Any number of options for a settings form, picked from a list and shown as
// tags in its button
export default function MultiSelect({
  label,
  description,
  name,
  options,
  defaultValue,
  placeholder,
}: Props) {
  const [value, setValue] = useState(defaultValue)
  const ref = useRef<HTMLDivElement>(null)
  // In the list's order rather than the order they were picked
  const selectedOptions = options.filter((option) =>
    value.includes(option.value),
  )

  // Options are picked in a popover outside the form, so the form hears of
  // the change from the field instead, like it would from an input
  function change(nextValue: string[]) {
    setValue(nextValue)
    ref.current?.dispatchEvent(new Event('change', { bubbles: true }))
  }

  return (
    <>
      {/* Saved values that aren't offered now, like a user who is gone for
          the moment, are sent back too, so saving doesn't drop them */}
      {value.map((item) => (
        <input key={item} type='hidden' name={name} value={item} />
      ))}
      <Select
        selectionMode='multiple'
        value={value}
        onChange={(keys) => change(keys.map(String))}
        placeholder={placeholder}
        className='input-wrapper'
        ref={ref}
      >
        <Button className='peer input input--select flex min-h-10 min-w-0 flex-wrap items-center text-left'>
          <SelectValue className='flex min-w-0 flex-wrap gap-1.5'>
            {({ isPlaceholder }) =>
              isPlaceholder || selectedOptions.length === 0 ? (
                <span className='text-neutral-400'>{placeholder}</span>
              ) : (
                selectedOptions.map((option) => (
                  <span
                    key={option.value}
                    className='icon-stat-wrapper text-sm'
                  >
                    {option.icon && (
                      <span className='option-icon'>{option.icon}</span>
                    )}
                    <span className='truncate'>{option.label}</span>
                  </span>
                ))
              )
            }
          </SelectValue>
        </Button>
        <Label className='label'>
          <span className='label-wrapper'>{label}</span>
          {description && <small>{description}</small>}
        </Label>
        <Popover
          offset={8}
          className='glass-sheet menu flex max-h-80 min-w-(--trigger-width) flex-col'
        >
          {/* Stays in sight while the list scrolls */}
          <SelectionActions
            options={options.map((option) => option.value)}
            value={value}
            onChange={change}
            className='mb-1.5 shrink-0 justify-end border-b border-white/10 pb-1.5'
          />
          <ListBox
            items={options}
            className='thin-scrollbar min-h-0 overflow-y-auto outline-none'
          >
            {(option) => (
              <ListBoxItem
                id={option.value}
                textValue={option.label}
                className='menu-item'
              >
                {({ isSelected }) => (
                  <>
                    {option.icon && (
                      <span className='option-icon w-7'>{option.icon}</span>
                    )}
                    <span className='truncate'>{option.label}</span>
                    {isSelected && <CheckIcon className='ml-auto size-4!' />}
                  </>
                )}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </Select>
    </>
  )
}
