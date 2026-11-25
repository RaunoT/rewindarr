// A form's values as they would be sent, in a form two reads can be compared
// in. Values sent more than once under a name count in any order, unless the
// order is saved too. Files are left out, as uploads save themselves, and so
// are the fields React adds for the form's action.
export function getFormSnapshot(
  entries: Iterable<[string, FormDataEntryValue]>,
  orderedNames: string[] = [],
) {
  const values = new Map<string, string[]>()

  for (const [name, value] of entries) {
    if (typeof value !== 'string' || name.startsWith('$ACTION')) {
      continue
    }

    values.set(name, [...(values.get(name) ?? []), value])
  }

  return JSON.stringify(
    [...values.keys()].sort().map((name) => {
      const list = values.get(name) ?? []

      return [name, orderedNames.includes(name) ? list : [...list].sort()]
    }),
  )
}

type LinkClick = {
  href: string
  target?: string | null
  isDownload?: boolean
  isDisabled?: boolean
  button: number
  hasModifier: boolean
}

// Where a click on a link would take this tab within the app, or null when it
// stays on the page, opens elsewhere or leaves the app, which the browser
// asks about itself
export function getLeavingPath(click: LinkClick, location: URL) {
  if (
    click.button !== 0 ||
    click.hasModifier ||
    click.isDownload ||
    click.isDisabled ||
    (click.target && click.target !== '_self')
  ) {
    return null
  }

  let url: URL

  try {
    url = new URL(click.href, location)
  } catch {
    return null
  }

  if (
    url.origin !== location.origin ||
    (url.pathname === location.pathname && url.search === location.search)
  ) {
    return null
  }

  return url.pathname + url.search + url.hash
}

type LeaveGuard = (leave: () => void) => void

let leaveGuard: LeaveGuard | null = null

// Set by a page with unsaved changes, to ask before leaving it
export function setLeaveGuard(guard: LeaveGuard | null) {
  leaveGuard = guard
}

// For navigation that isn't a link click, like a menu or signing out
export function guardLeave(leave: () => void) {
  if (leaveGuard) {
    leaveGuard(leave)
  } else {
    leave()
  }
}
