'use client'

import Select from '@/components/Select'
import {
  HISTORY_PAGE_SIZE_COOKIE_NAME,
  HISTORY_PAGE_SIZES,
} from '@/utils/constants'
import { setCookie } from '@/utils/cookies'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Props = {
  value: number
}

// Saved for the next visit too, and a new size starts from the first page.
// The options say what they count, so the select needs no label beside it.
export default function PageSizeSelect({ value }: Props) {
  const t = useTranslations('History')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(size: string) {
    const params = new URLSearchParams(searchParams.toString())

    params.delete('page')
    params.set('rows', size)
    setCookie(HISTORY_PAGE_SIZE_COOKIE_NAME, size)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Select
      label={t('rowsLabel')}
      options={HISTORY_PAGE_SIZES.map((size) => ({
        value: String(size),
        label: t('rowsOption', { count: size }),
      }))}
      value={String(value)}
      onChange={handleChange}
    />
  )
}
