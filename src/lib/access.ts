import { Settings, SettingsFormInitialState } from '@/types/settings'
import getSettings from '@/utils/getSettings'
import {
  canViewFeature,
  getViewer,
  isInitialSetup,
  isSettingsPageLocked,
} from '@/utils/helpers'
import { isRewindShareCookie, REWIND_SHARE_COOKIE } from '@/utils/rewindShare'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authOptions } from './auth'

// Settings are open to anyone only until the first setup has been completed.
export async function canManageSettings(
  settings: Settings = getSettings(),
): Promise<boolean> {
  if (isInitialSetup(settings)) {
    return true
  }

  const session = await getServerSession(authOptions)

  return !!session?.user?.isAdmin
}

export async function requireSettingsAccess(pageKey?: string): Promise<void> {
  const settings = getSettings()

  if (!(await canManageSettings(settings))) {
    redirect('/')
  }

  if (pageKey && isSettingsPageLocked(pageKey, settings)) {
    redirect('/settings/connection')
  }
}

// Server actions can be called directly, so each settings action checks access
// before doing anything else.
export async function denySettingsAccess<T>(
  prevState: SettingsFormInitialState<T>,
  pageKey?: string,
): Promise<SettingsFormInitialState<T> | null> {
  const settings = getSettings()

  if (
    (await canManageSettings(settings)) &&
    (!pageKey || !isSettingsPageLocked(pageKey, settings))
  ) {
    return null
  }

  const t = await getTranslations('Settings')

  return {
    message: t('genericError'),
    status: 'error',
    fields: prevState?.fields,
  }
}

// Rewind's music plays for anyone who can see a Rewind, and for a visitor who
// opened a shared one
export async function canPlayRewind(
  settings: Settings = getSettings(),
): Promise<boolean> {
  const session = await getServerSession(authOptions)

  if (canViewFeature(settings, 'rewind', getViewer(session))) {
    return true
  }

  const cookie = (await cookies()).get(REWIND_SHARE_COOKIE)?.value

  return isRewindShareCookie(settings, cookie)
}
