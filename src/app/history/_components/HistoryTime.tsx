import { formatClockTime, formatDateTime } from '@/utils/formatting'
import { useLocale } from 'next-intl'

type Props = {
  time: Date
  timeZone?: string
}

// The time, as the list's headings have the day. The full date is on hover.
// In the viewer's timezone like the headings, or the Rewindarr server's without
// one.
export default function HistoryTime({ time, timeZone }: Props) {
  const locale = useLocale()

  return (
    <time
      dateTime={time.toISOString()}
      title={formatDateTime(time, locale, timeZone)}
      className='whitespace-nowrap'
    >
      {formatClockTime(time, locale, timeZone)}
    </time>
  )
}
