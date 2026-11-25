import { canPlayRewind } from '@/lib/access'
import getSettings from '@/utils/getSettings'
import { isSignedTheme, streamPlexAudio } from '@/utils/plexAudio'

export const dynamic = 'force-dynamic'

// Streams a theme song from Plex, which needs the token the browser can't have
export async function GET(request: Request) {
  const settings = getSettings()
  const { searchParams } = new URL(request.url)
  const ratingKey = searchParams.get('key') ?? ''

  if (
    !(await canPlayRewind(settings)) ||
    !settings.rewind.isThemeMusicActive ||
    !/^\d+$/.test(ratingKey) ||
    !isSignedTheme(ratingKey, searchParams.get('sig') ?? '')
  ) {
    return new Response(null, { status: 404 })
  }

  return streamPlexAudio(settings, 'theme', ratingKey, request)
}
