import { requireSettingsAccess } from '@/lib/access'
import getSettings from '@/utils/getSettings'
import { getLibrarySlug } from '@/utils/helpers'
import { toPublicSettings } from '@/utils/publicSettings'
import { getReachableLibraries, getUsers } from '@/utils/statsSource'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import GeneralSettingsForm from './_components/GeneralSettingsForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Settings.General')

  return {
    title: t('title'),
  }
}

export default async function GeneralSettingsPage() {
  await requireSettingsAccess()

  const [libraries, users] = await Promise.all([
    getReachableLibraries(false),
    getUsers(),
  ])
  const settings = getSettings()

  // A first setup, or a source switch whose libraries couldn't be read yet,
  // starts with every library on, so it has something to show
  if (!settings.general.complete && !settings.general.activeLibraries.length) {
    settings.general.activeLibraries =
      libraries?.map((library) => getLibrarySlug(library)) ?? []
  }

  return (
    <GeneralSettingsForm
      // A retry can bring in the libraries, which the form only reads once
      key={libraries?.map((library) => library.section_id).join()}
      settings={toPublicSettings(settings)}
      libraries={libraries}
      // Emails and other account details stay on the server.
      users={users.map(({ user_id, friendly_name, thumb, user_thumb }) => ({
        user_id,
        friendly_name,
        avatar: user_thumb || thumb,
      }))}
    />
  )
}
