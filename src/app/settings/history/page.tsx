import { requireSettingsAccess } from '@/lib/access'
import getSettings from '@/utils/getSettings'
import { toPublicSettings } from '@/utils/publicSettings'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import HistorySettingsForm from './_components/HistorySettingsForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Settings.History')

  return {
    title: t('title'),
  }
}

export default async function HistorySettingsPage() {
  await requireSettingsAccess()

  const settings = getSettings()

  return <HistorySettingsForm settings={toPublicSettings(settings)} />
}
