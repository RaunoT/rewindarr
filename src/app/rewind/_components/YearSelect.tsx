'use client'

import { getEditionOptions, parseEditionYear } from '@/utils/rewindPeriod'
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from 'react-aria-components'

type Props = {
  // The past editions each user played in, by user ID
  yearsByUser: Record<string, number[]>
  latestYear: number
  // Whose Rewind it is without a user in the URL
  defaultUserId: string
  // The users the URL can pick, which only admins can
  userIds: string[]
}

// Rendered by the layout, so it stays on screen while another year loads.
// It keeps the picked user, as the user picker keeps the year.
export default function YearSelect({
  yearsByUser,
  latestYear,
  defaultUserId,
  userIds,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('YearSelect')
  const userIdParam = searchParams.get('userId')
  const userId =
    userIdParam && userIds.includes(userIdParam) ? userIdParam : defaultUserId
  const year =
    parseEditionYear(searchParams.get('year'), latestYear) ?? latestYear
  const years = getEditionOptions(yearsByUser[userId] ?? [], latestYear, year)

  if (years.length < 2) {
    return null
  }

  function handleChange(key: string) {
    const newParams = new URLSearchParams(searchParams.toString())

    // The latest edition is the default, so its link stays the plain one
    if (key === String(latestYear)) {
      newParams.delete('year')
    } else {
      newParams.set('year', key)
    }

    const query = newParams.toString()

    router.push(query ? `/rewind?${query}` : '/rewind')
  }

  return (
    <Select
      aria-label={t('label')}
      value={String(year)}
      onChange={(key) => key !== null && handleChange(String(key))}
      className='shrink-0'
    >
      <Button className='filter-button pl-3'>
        <CalendarIcon />
        <SelectValue />
        <ChevronDownIcon className='-mr-1 size-3.5!' />
      </Button>
      <Popover
        placement='bottom end'
        offset={8}
        className='glass-sheet menu max-h-80 min-w-(--trigger-width) overflow-y-auto'
      >
        <ListBox className='outline-none'>
          {years.map((option) => (
            <ListBoxItem
              key={option}
              id={String(option)}
              textValue={String(option)}
              className='menu-item'
            >
              {({ isSelected }) => (
                <>
                  <span className='tabular-nums'>{option}</span>
                  {isSelected && <CheckIcon className='ml-auto size-4!' />}
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  )
}
