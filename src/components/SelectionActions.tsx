'use client'

import { clearAll, selectAll } from '@/utils/selection'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { Button } from 'react-aria-components'

type Props = {
  // The values of the options offered
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  className?: string
}

// Picks every option of a list of any number, or none of them
export default function SelectionActions({
  options,
  value,
  onChange,
  className,
}: Props) {
  const t = useTranslations('Common')
  const isAllPicked = options.every((option) => value.includes(option))
  const isNonePicked = !options.some((option) => value.includes(option))

  return (
    <div className={clsx('flex items-center gap-1', className)}>
      <Button
        className='selection-action'
        isDisabled={isAllPicked}
        onPress={() => onChange(selectAll(value, options))}
      >
        {t('selectAll')}
      </Button>
      <Button
        className='selection-action'
        isDisabled={isNonePicked}
        onPress={() => onChange(clearAll(value, options))}
      >
        {t('clear')}
      </Button>
    </div>
  )
}
