import { canPlayRewind } from '@/lib/access'
import getSettings from '@/utils/getSettings'
import { streamPlexAudio } from '@/utils/plexAudio'

export const dynamic = 'force-dynamic'

// Streams a theme song from Plex, which needs the token the browser can't have
export async function GET(request: Request) {
  const settings = getSettings()
  const ratingKey = new URL(request.url).searchParams.get('key') ?? ''

  if (
    !(await canPlayRewind(settings)) ||
    !settings.rewind.isThemeMusicActive ||
    !/^\d+$/.test(ratingKey)
  ) {
    return new Response(null, { status: 404 })
  }

  return streamPlexAudio(settings, 'theme', ratingKey, request)
}
