'use client'

import getMediaDetails from '@/app/activity/_actions/getMediaDetails'
import { PublicSettings } from '@/types/settings'
import { ActivitySession } from '@/types/statsSource'
import { getImageProxyUrl } from '@/utils/imageProxy'
import { useQuery } from '@tanstack/react-query'

// The year and ratings are the show's or movie's, found like the dashboard's
// items. The poster comes from TMDB only when there's no other or the
// settings ask for it.
export function useMediaDetails(
  session: ActivitySession,
  settings: PublicSettings,
) {
  const {
    media_type,
    title,
    grandparent_title,
    grandparent_thumb,
    thumb,
    year,
    guids,
    grandparent_guids,
  } = session
  const originalPoster = grandparent_thumb || thumb
  const sourcePoster = originalPoster ? getImageProxyUrl(originalPoster) : null
  const isVideo = media_type === 'episode' || media_type === 'movie'
  const isTmdbPoster =
    isVideo && (settings.general.isPostersTmdbOnly || !originalPoster)
  const queryKey =
    media_type === 'episode'
      ? [
          'media-details',
          'tv',
          grandparent_title,
          grandparent_guids ?? [],
          guids ?? [],
        ]
      : ['media-details', 'movie', title, Number(year) || null, guids ?? []]
  const { data: details, isLoading } = useQuery({
    queryKey,
    queryFn: async () =>
      // An episode's year is its own, not the show's, so it's no help here
      media_type === 'episode'
        ? await getMediaDetails({
            type: 'tv',
            title: grandparent_title,
            guids: grandparent_guids,
            episodeGuids: guids,
          })
        : await getMediaDetails({
            type: 'movie',
            title,
            year: Number(year) || undefined,
            guids,
          }),
    enabled: isVideo,
    retry: 1,
    staleTime: 1000 * 60 * 60, // 1 hour
  })

  return {
    posterUrl: (isTmdbPoster && details?.poster) || sourcePoster,
    isPosterLoading: isTmdbPoster && isLoading,
    details: details ?? null,
    isDetailsLoading: isVideo && isLoading,
  }
}
