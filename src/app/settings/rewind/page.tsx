import { requireSettingsAccess } from '@/lib/access'
import getSettings from '@/utils/getSettings'
import { checkRequiredSettings } from '@/utils/helpers'
import { toPublicSettings } from '@/utils/publicSettings'
import { canShareRewind, getRewindSharePath } from '@/utils/rewindShare'
import { getRewindUserName } from '@/utils/rewindUser'
import { getActiveUsers } from '@/utils/statsSource'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import RewindSettingsForm from './_components/RewindSettingsForm'
import { ShareUser } from './_components/RewindShareLinks'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Settings.Rewind')

  return {
    title: t('title'),
  }
}

async function getShareUsers(): Promise<ShareUser[] | null> {
  const settings = getSettings()

  try {
    const users = await getActiveUsers(settings)

    return users
      .flatMap((user) => {
        const id = String(user.user_id)
        const path = getRewindSharePath(settings, id)

        return path
          ? [
              {
                id,
                name: getRewindUserName(user),
                thumb: user.user_thumb || user.thumb || null,
                path,
              },
            ]
          : []
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    console.error('[REWIND] - Error reading the users to share with!', error)

    return null
  }
}

export default async function RewindSettingsPage() {
  await requireSettingsAccess('rewind')

  const settings = getSettings()
  // Not during the setup, when there's no one to share with yet
  const canShare = !checkRequiredSettings(settings) && canShareRewind(settings)
  const currentYear = new Date().getFullYear()

  return (
    <RewindSettingsForm
      settings={toPublicSettings(settings)}
      currentYear={currentYear}
      // Not waited for, so the form shows while they're read
      shareUsers={canShare ? getShareUsers() : undefined}
    />
  )
}
