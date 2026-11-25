'use client'

import { getFormSnapshot } from '@/utils/unsavedChanges'
import { RefObject, useCallback, useEffect, useRef, useState } from 'react'

// Whether a form's values differ from the ones it was saved with. The fields
// are read from the form itself, so it works for any field: a value changes
// with an input or change event, or when a field or a hidden input is swapped.
export default function useFormChanges(
  formRef: RefObject<HTMLFormElement | null>,
  // Fields whose values are saved in the order they're sent
  orderedNames?: string[],
) {
  const [isChanged, setIsChanged] = useState(false)
  const savedRef = useRef<string>(null)
  const orderedKey = orderedNames?.join()
  const read = useCallback(() => {
    const form = formRef.current

    return form
      ? getFormSnapshot(new FormData(form), orderedKey?.split(','))
      : null
  }, [formRef, orderedKey])
  // Takes the form as it is now as saved
  const markSaved = useCallback(() => {
    savedRef.current = read()
    setIsChanged(false)
  }, [read])

  useEffect(() => {
    const form = formRef.current

    if (!form) {
      return
    }

    savedRef.current = read()

    let frame = 0

    // A frame later, once React has drawn what the event changed
    function check() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setIsChanged(savedRef.current !== null && read() !== savedRef.current)
      })
    }

    const observer = new MutationObserver(check)

    form.addEventListener('input', check)
    form.addEventListener('change', check)
    observer.observe(form, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['name', 'value', 'checked', 'disabled'],
    })

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      form.removeEventListener('input', check)
      form.removeEventListener('change', check)
    }
  }, [formRef, read])

  return { isChanged, markSaved }
}
