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
      title={new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone,
      }).format(time)}
      className='whitespace-nowrap'
    >
      {new Intl.DateTimeFormat(locale, {
        timeStyle: 'short',
        timeZone,
      }).format(time)}
    </time>
  )
}
