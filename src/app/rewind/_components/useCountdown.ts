import { useContext, useEffect } from 'react'
import { getCountdownStart } from './countdown'
import { StoryStepContext } from './Stories'

// Reveals a ranked list in a story's first statement from its last place up,
// a step each, so the first place comes last. Returns the index of the highest
// place shown.
export default function useCountdown(count: number) {
  const { step, registerStep } = useContext(StoryStepContext)

  // So the story controls can step to each place after the last one
  useEffect(() => {
    const unregisters = Array.from({ length: count - 1 }, (_, i) =>
      registerStep(i + 1),
    )

    return () => unregisters.forEach((unregister) => unregister())
  }, [registerStep, count])

  return getCountdownStart(count, step)
}
