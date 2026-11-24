import { canPlayRewind } from '@/lib/access'
import getSettings from '@/utils/getSettings'
import { parsePreviewItem, streamPreview } from '@/utils/musicPreview'

export const dynamic = 'force-dynamic'

// Streams a preview of a movie's or show's soundtrack, or of a song Rewind
// picked
export async function GET(request: Request) {
  const settings = getSettings()
  const item = parsePreviewItem(new URL(request.url).searchParams)

  if (
    !(await canPlayRewind(settings)) ||
    !settings.rewind.isThemeMusicActive ||
    !item
  ) {
    return new Response(null, { status: 404 })
  }

  return streamPreview(item, request)
}
