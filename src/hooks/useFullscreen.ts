import { useCallback, useEffect, useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange)

  return () => document.removeEventListener('fullscreenchange', onChange)
}

function subscribeToNothing() {
  return () => {}
}

function getIsFullscreen() {
  return !!document.fullscreenElement
}

// iPhones only show videos in full screen, and older Safari only has its own
// prefixed version
function getIsSupported() {
  return document.fullscreenEnabled === true
}

function getServerSnapshot() {
  return false
}

// The rest of the page, which full screen hides
function getOutside(element: Element) {
  const outside: Element[] = []

  let node = element

  while (node !== document.body && node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling !== node && !sibling.hasAttribute('inert')) {
        outside.push(sibling)
      }
    }

    node = node.parentElement
  }

  return outside
}

// Shows what `getElement` returns in full screen, or leaves it
export default function useFullscreen(
  getElement: () => Element | null | undefined,
) {
  const isFullscreen = useSyncExternalStore(
    subscribe,
    getIsFullscreen,
    getServerSnapshot,
  )
  const isSupported = useSyncExternalStore(
    subscribeToNothing,
    getIsSupported,
    getServerSnapshot,
  )
  const toggle = useCallback(() => {
    // Either can be refused, such as when the page lost focus
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      const element = getElement()

      element?.requestFullscreen().catch(() => {})
    }
  }, [getElement])

  // What can't be seen can't take focus either
  useEffect(() => {
    const element = document.fullscreenElement

    if (!isFullscreen || !element) {
      return
    }

    const outside = getOutside(element)

    outside.forEach((other) => other.setAttribute('inert', ''))

    return () => outside.forEach((other) => other.removeAttribute('inert'))
  }, [isFullscreen])

  return { isFullscreen, isSupported, toggle }
}
