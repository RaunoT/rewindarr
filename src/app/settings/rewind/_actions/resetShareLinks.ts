'use server'

import { canManageSettings } from '@/lib/access'
import getSettings, { writeSettings } from '@/utils/getSettings'

// Signs the links with a new version, so every link shared before stops
// working. Saved apart from the rest of the form.
export default async function resetShareLinks(): Promise<boolean> {
  if (!(await canManageSettings())) {
    return false
  }

  try {
    const settings = getSettings()

    settings.rewind.shareVersion += 1
    writeSettings(settings)

    return true
  } catch (error) {
    console.error('[REWIND] - Error resetting the share links!', error)

    return false
  }
}
