import { useLocale } from 'next-intl'

type Props = {
  time: Date
}

// The time, as the list's headings have the day. The full date is on hover.
// In the Rewindarr server's timezone, like the headings.
export default function HistoryTime({ time }: Props) {
  const locale = useLocale()

  return (
    <time
      dateTime={time.toISOString()}
      title={new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(time)}
      className='whitespace-nowrap'
    >
      {new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(time)}
    </time>
  )
}
