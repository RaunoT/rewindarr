'use client'

import { CheckIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { ReactNode } from 'react'
import {
  Select as AriaSelect,
  Button,
  Header,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover,
  SelectValue,
} from 'react-aria-components'

export type SelectOption = {
  value: string
  label: string
}

type BaseProps = {
  // The select's name for screen readers
  label: string
  options: SelectOption[]
  // Over the options, such as "Sort"
  heading?: string
  // On the wrapper, for widths
  className?: string
}

type SelectProps = BaseProps & {
  value: string
  onChange: (value: string) => void
}

// Phones and tablets get their own picker, which beats any list drawn on the
// page. With a mouse or a trackpad, a list like the app's other menus. Both
// are rendered and CSS shows one, so the server and the browser agree.
const NATIVE = 'pointer-fine:hidden'
const CUSTOM = 'hidden pointer-fine:block'

// Each label laid over the others, unseen, so the button is as wide as the
// longest one, like a native select, and doesn't change width with the value
function Sizer({ options }: { options: SelectOption[] }) {
  return options.map((option) => (
    <span
      key={option.value}
      className='invisible col-start-1 row-start-1 truncate'
      aria-hidden='true'
    >
      {option.label}
    </span>
  ))
}

function OptionList({
  options,
  heading,
}: Pick<BaseProps, 'options' | 'heading'>) {
  const items = options.map((option) => (
    <ListBoxItem
      key={option.value}
      id={option.value}
      textValue={option.label}
      className='menu-item'
    >
      {({ isSelected }) => (
        <>
          <span className='truncate'>{option.label}</span>
          {isSelected && <CheckIcon className='ml-auto size-4!' />}
        </>
      )}
    </ListBoxItem>
  ))

  return (
    <ListBox className='outline-none'>
      {heading ? (
        <ListBoxSection>
          <Header className='px-3 pt-1.5 pb-1 text-xs font-semibold text-neutral-400'>
            {heading}
          </Header>
          {items}
        </ListBoxSection>
      ) : (
        items
      )}
    </ListBox>
  )
}

// Opens the list, as wide as its longest option
function Trigger({
  options,
  children,
}: {
  options: SelectOption[]
  children: ReactNode
}) {
  return (
    <Button className='input input--small input--select grid text-left'>
      <Sizer options={options} />
      {children}
    </Button>
  )
}

function OptionsPopover({
  options,
  heading,
}: Pick<BaseProps, 'options' | 'heading'>) {
  return (
    <Popover
      offset={8}
      className='glass-sheet menu max-h-80 min-w-(--trigger-width) overflow-y-auto'
    >
      <OptionList options={options} heading={heading} />
    </Popover>
  )
}

export default function Select({
  label,
  options,
  heading,
  className,
  value,
  onChange,
}: SelectProps) {
  return (
    <div className={clsx('input-wrapper', className)}>
      <div className={clsx('select-wrapper', NATIVE)}>
        <select
          className='input input--small truncate'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        >
          {heading && <option disabled>{heading}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <AriaSelect
        aria-label={label}
        value={value}
        onChange={(key) => key !== null && onChange(String(key))}
        className={clsx(CUSTOM, 'w-full min-w-0')}
      >
        <Trigger options={options}>
          <SelectValue className='col-start-1 row-start-1 truncate' />
        </Trigger>
        <OptionsPopover options={options} heading={heading} />
      </AriaSelect>
    </div>
  )
}
