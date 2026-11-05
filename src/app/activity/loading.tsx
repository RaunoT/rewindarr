import getSettings from '@/utils/getSettings'
import ActivitiesSkeleton from './_components/ActivitiesSkeleton'

export default function Loading() {
  // Only what the skeleton needs, as it's sent to the browser
  const { activeExternalLinks, activeItemStatistics } = getSettings().general

  return (
    <ActivitiesSkeleton
      general={{ activeExternalLinks, activeItemStatistics }}
    />
  )
}
