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

// The saved form with the loaded fields that weren't in it yet, at their
// values in the current one. Only those, as others that appeared meanwhile
// came from an edit, while these can't have been edited before they did.
export function addLoadedFields(
  saved: string,
  current: string,
  loadedNames: string[],
) {
  const fields = new Map<string, string[]>(JSON.parse(saved))

  for (const [name, values] of JSON.parse(current) as [string, string[]][]) {
    if (!fields.has(name) && loadedNames.includes(name)) {
      fields.set(name, values)
    }
  }

  return JSON.stringify(
    [...fields.keys()].sort().map((name) => [name, fields.get(name)]),
  )
}

type SaveResult = {
  // As sent, or null when it wasn't read
  submitted: string | null
  // As the form is once the save is done
  current: string
  isEditedSinceSubmit: boolean
}

// What a finished save counts as saved: the form as it is then, with any value
// the save changed, like a masked API key. If it was edited while the save was
// on its way, what was sent instead, so those edits still count as unsaved.
export function getSavedSnapshot({
  submitted,
  current,
  isEditedSinceSubmit,
}: SaveResult) {
  return isEditedSinceSubmit && submitted !== null ? submitted : current
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

type Leave = () => unknown

type LeaveGuard = (leave: Leave) => void

let leaveGuard: LeaveGuard | null = null

// Set by a page with unsaved changes, to ask before leaving it
export function setLeaveGuard(guard: LeaveGuard | null) {
  leaveGuard = guard
}

// For navigation that isn't a link click, like a menu or signing out
export function guardLeave(leave: Leave) {
  if (leaveGuard) {
    leaveGuard(leave)
  } else {
    leave()
  }
}
