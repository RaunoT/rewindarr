'use client'

import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from 'react-aria-components'

type Props = {
  // The past editions the viewer played in, newest first
  years: number[]
}

// The editions before the latest one, which the tile's own button opens
export default function EarlierRewinds({ years }: Props) {
  const router = useRouter()
  const t = useTranslations('Home')

  return (
    <MenuTrigger>
      <Button className='button button--glass'>
        {t('earlierRewinds')}
        <ChevronDownIcon className='-mr-1 size-4' />
      </Button>
      <Popover
        placement='bottom start'
        offset={8}
        className='glass-sheet menu min-w-(--trigger-width)'
      >
        <Menu
          aria-label={t('earlierRewinds')}
          className='outline-none'
          onAction={(year) => router.push(`/rewind?year=${year}`)}
        >
          {years.map((year) => (
            <MenuItem
              key={year}
              id={year}
              textValue={String(year)}
              className='menu-item tabular-nums'
            >
              {year}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}
