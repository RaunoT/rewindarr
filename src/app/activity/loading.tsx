import getSettings from '@/utils/getSettings'
import { isSeerrActive } from '@/utils/historyRequests'
import ActivitiesSkeleton from './_components/ActivitiesSkeleton'

export default function Loading() {
  // Only what the skeleton needs, as it's sent to the browser
  const settings = getSettings()
  const { activeExternalLinks, activeItemStatistics } = settings.general

  return (
    <ActivitiesSkeleton
      general={{ activeExternalLinks, activeItemStatistics }}
      isSeerrActive={isSeerrActive(settings)}
    />
  )
}
