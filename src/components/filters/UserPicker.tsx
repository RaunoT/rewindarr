'use client'

import Avatar from '@/components/Avatar'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogTrigger,
  ListBox,
  ListBoxItem,
  Popover,
} from 'react-aria-components'

export type UserOption = {
  value: string
  label: string
  // The profile picture, which Avatar proxies itself
  avatar?: string
}

type ListProps = {
  // The list's name for screen readers
  label: string
  options: UserOption[]
  // A choice of any number has none picked for everyone
  selectionMode: 'single' | 'multiple'
  value: string[]
  onChange: (value: string[]) => void
  className?: string
}

function UserAvatar({ user }: { user: UserOption }) {
  return (
    <span className='relative size-6 shrink-0 overflow-hidden rounded-full'>
      <Avatar src={user.avatar} name={user.label} sizes='1.5rem' />
    </span>
  )
}

// The users with their pictures, for the filters and the Rewind user picker
export function UserList({
  label,
  options,
  selectionMode,
  value,
  onChange,
  className,
}: ListProps) {
  return (
    <ListBox
      aria-label={label}
      items={options}
      selectionMode={selectionMode}
      disallowEmptySelection={selectionMode === 'single'}
      selectedKeys={value}
      onSelectionChange={(keys) =>
        onChange(
          keys === 'all'
            ? options.map((option) => option.value)
            : [...keys].map(String),
        )
      }
      // Apart, so the hover of one doesn't run into the next
      className={clsx(
        'thin-scrollbar flex flex-col gap-1 overflow-y-auto outline-none',
        className,
      )}
    >
      {(option) => (
        <ListBoxItem
          id={option.value}
          textValue={option.label}
          className='menu-item'
        >
          {({ isSelected }) => (
            <>
              <UserAvatar user={option} />
              <span className='truncate'>{option.label}</span>
              {isSelected && <CheckIcon className='ml-auto size-4!' />}
            </>
          )}
        </ListBoxItem>
      )}
    </ListBox>
  )
}

type PickerProps = Omit<ListProps, 'selectionMode'>

// A button with the picked user that opens the list, which closes again once
// another is picked
export default function UserPicker({
  label,
  options,
  value,
  onChange,
  className,
}: PickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const picked = options.find((option) => value.includes(option.value))

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        className={clsx('filter-button pl-2', className)}
        aria-label={picked ? `${label}: ${picked.label}` : label}
      >
        {picked && <UserAvatar user={picked} />}
        <span className='truncate'>{picked?.label ?? label}</span>
        <ChevronDownIcon className='-mr-1 size-3.5!' />
      </Button>
      <Popover
        placement='bottom end'
        offset={8}
        className='glass-sheet menu w-72 max-w-[calc(100vw-2rem)]'
      >
        <Dialog aria-label={label} className='outline-none'>
          <UserList
            label={label}
            options={options}
            selectionMode='single'
            value={value}
            className='max-h-72'
            onChange={(newValue) => {
              onChange(newValue)
              setIsOpen(false)
            }}
          />
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
