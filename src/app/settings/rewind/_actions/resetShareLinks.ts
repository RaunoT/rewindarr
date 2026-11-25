'use server'

import { canManageSettings } from '@/lib/access'
import getSettings, { writeSettings } from '@/utils/getSettings'
import { isSettingsPageLocked } from '@/utils/helpers'

// Signs the links with a new version, so every link shared before stops
// working. Saved apart from the rest of the form.
export default async function resetShareLinks(): Promise<boolean> {
  const settings = getSettings()

  if (
    !(await canManageSettings(settings)) ||
    isSettingsPageLocked('rewind', settings)
  ) {
    return false
  }

  try {
    settings.rewind.shareVersion += 1
    writeSettings(settings)

    return true
  } catch (error) {
    console.error('[REWIND] - Error resetting the share links!', error)

    return false
  }
}
