import { useEffect, useState } from 'react'

type Settled<T> = { value: T } | { error: unknown }

// What a promise from the server resolves to, undefined until then, without
// suspending what shows meanwhile. A new promise, as after a refresh, takes over
// once it resolves. A rejection is thrown, so the route's error page shows it.
export default function usePromiseValue<T>(promise: Promise<T>): T | undefined {
  const [settled, setSettled] = useState<Settled<T>>()

  useEffect(() => {
    let isCurrent = true

    promise.then(
      (value) => {
        if (isCurrent) {
          setSettled({ value })
        }
      },
      (error: unknown) => {
        if (isCurrent) {
          setSettled({ error })
        }
      },
    )

    return () => {
      isCurrent = false
    }
  }, [promise])

  if (settled && 'error' in settled) {
    throw settled.error
  }

  return settled?.value
}
