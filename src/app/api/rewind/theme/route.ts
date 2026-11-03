import { authOptions } from '@/lib/auth'
import getSettings from '@/utils/getSettings'
import { canViewFeature, getViewer } from '@/utils/helpers'
import { streamPlexAudio } from '@/utils/plexAudio'
import { getServerSession } from 'next-auth'

export const dynamic = 'force-dynamic'

// Streams a theme song from Plex, which needs the token the browser can't have
export async function GET(request: Request) {
  const settings = getSettings()
  const session = await getServerSession(authOptions)
  const ratingKey = new URL(request.url).searchParams.get('key') ?? ''

  if (
    !canViewFeature(settings, 'rewind', getViewer(session)) ||
    !settings.rewind.isThemeMusicActive ||
    !/^\d+$/.test(ratingKey)
  ) {
    return new Response(null, { status: 404 })
  }

  return streamPlexAudio(settings, 'theme', ratingKey, request)
}
