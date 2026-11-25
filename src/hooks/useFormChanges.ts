'use client'

import {
  addLoadedFields,
  getFormSnapshot,
  getSavedSnapshot,
} from '@/utils/unsavedChanges'
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
  // The form as it was sent, until its save is done
  const submittedRef = useRef<string>(null)
  const isEditedSinceSubmitRef = useRef(false)
  const orderedKey = orderedNames?.join()
  const read = useCallback(() => {
    const form = formRef.current

    return form
      ? getFormSnapshot(new FormData(form), orderedKey?.split(','))
      : null
  }, [formRef, orderedKey])
  const markSubmitted = useCallback(() => {
    submittedRef.current = read()
    isEditedSinceSubmitRef.current = false
  }, [read])
  const markSaved = useCallback(() => {
    const current = read()

    savedRef.current = current
      ? getSavedSnapshot({
          submitted: submittedRef.current,
          current,
          isEditedSinceSubmit: isEditedSinceSubmitRef.current,
        })
      : null
    submittedRef.current = null
    setIsChanged(current !== savedRef.current)
  }, [read])
  // Fields that appear once their data is read count as saved as they come.
  // Before the form is first read, they're read with it.
  const markLoaded = useCallback(() => {
    const current = read()

    if (current === null || savedRef.current === null) {
      return
    }

    savedRef.current = addLoadedFields(savedRef.current, current)
    setIsChanged(current !== savedRef.current)
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

    // Anything done in the form while a save is on its way
    function noteEdit() {
      if (submittedRef.current !== null) {
        isEditedSinceSubmitRef.current = true
      }
    }

    function handleEdit() {
      noteEdit()
      check()
    }

    const observer = new MutationObserver(check)

    form.addEventListener('input', handleEdit)
    form.addEventListener('change', handleEdit)
    form.addEventListener('keydown', noteEdit)
    form.addEventListener('pointerdown', noteEdit)
    observer.observe(form, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['name', 'value', 'checked', 'disabled'],
    })

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      form.removeEventListener('input', handleEdit)
      form.removeEventListener('change', handleEdit)
      form.removeEventListener('keydown', noteEdit)
      form.removeEventListener('pointerdown', noteEdit)
    }
  }, [formRef, read])

  return { isChanged, markSubmitted, markSaved, markLoaded }
}
