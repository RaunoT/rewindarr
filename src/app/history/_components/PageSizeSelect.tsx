'use client'

import {
  HISTORY_PAGE_SIZE_COOKIE_NAME,
  HISTORY_PAGE_SIZES,
} from '@/utils/constants'
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
    document.cookie = `${HISTORY_PAGE_SIZE_COOKIE_NAME}=${size}; path=/; max-age=31536000; samesite=lax`
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className='select-wrapper w-auto'>
      <select
        className='input input--small w-auto'
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        aria-label={t('rowsLabel')}
      >
        {HISTORY_PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {t('rowsOption', { count: size })}
          </option>
        ))}
      </select>
    </div>
  )
}
