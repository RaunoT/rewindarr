'use client'

import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { Button, Input, SearchField } from 'react-aria-components'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  // For the clear button, which screen readers announce
  clearLabel: string
  className?: string
}

// A glass pill as tall as the filters next to it. Escape or the cross clears
// it, the cross only showing while there's something to clear.
export default function SearchPill({
  label,
  value,
  onChange,
  clearLabel,
  className,
}: Props) {
  return (
    <SearchField
      aria-label={label}
      value={value}
      onChange={onChange}
      className={clsx('search-pill', className)}
    >
      <MagnifyingGlassIcon aria-hidden='true' />
      <Input placeholder={label} />
      <Button aria-label={clearLabel} className='search-pill-clear'>
        <XMarkIcon className='size-4' />
      </Button>
    </SearchField>
  )
}
