import { authOptions } from '@/lib/auth'
import getSettings from '@/utils/getSettings'
import { canViewFeature, getViewer } from '@/utils/helpers'
import { parsePreviewItem, streamPreview } from '@/utils/musicPreview'
import { getServerSession } from 'next-auth'

export const dynamic = 'force-dynamic'

// Streams a preview of a movie's or show's soundtrack, or of a song Rewind
// picked
export async function GET(request: Request) {
  const settings = getSettings()
  const session = await getServerSession(authOptions)
  const item = parsePreviewItem(new URL(request.url).searchParams)

  if (
    !canViewFeature(settings, 'rewind', getViewer(session)) ||
    !settings.rewind.isThemeMusicActive ||
    !item
  ) {
    return new Response(null, { status: 404 })
  }

  return streamPreview(item, request)
}
