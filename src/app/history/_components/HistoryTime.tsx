import { useLocale } from 'next-intl'

type Props = {
  time: Date
}

// The full date over the time, in the Rewindarr server's timezone
export default function HistoryTime({ time }: Props) {
  const locale = useLocale()

  return (
    <time dateTime={time.toISOString()}>
      <span className='block'>
        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(time)}
      </span>
      <span className='block text-neutral-200'>
        {new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(time)}
      </span>
    </time>
  )
}
