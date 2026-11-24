import { canManageSettings } from '@/lib/access'
import {
  ConnectionTestResult,
  MediaServerType,
  TestedService,
} from '@/types/settings'
import { ConnectionError } from '@/utils/connectionErrors'
import { readConnectionForm } from '@/utils/connectionForm'
import { restoreApiKeys, SecretService } from '@/utils/connectionSecrets'
import {
  testMediaServerUrl,
  testPlexToken,
  testSeerr,
  testTautulli,
  testTracearr,
} from '@/utils/connectionTests'
import getSettings from '@/utils/getSettings'
import { getMediaServerUrl, isMediaServerType } from '@/utils/mediaServerName'
import { getTranslations } from 'next-intl/server'

const SECRETS: Record<TestedService, SecretService[]> = {
  tautulli: ['Tautulli'],
  tracearr: ['Tracearr'],
  mediaServer: ['Plex'],
  seerr: ['Seerr'],
}

export const dynamic = 'force-dynamic'

type Body = {
  service: TestedService
  // The form knows which server Tracearr's chosen one is
  mediaServerType: MediaServerType
  // The settings form's fields, as FormData entries
  fields: [string, string][]
}

// Tests one service with what's in the settings form, without saving it. A
// route rather than a server action, as those run one at a time and the tests
// of slow services would hold up a save.
export async function POST(request: Request) {
  // A form on another site can't send JSON without asking first, so it can't
  // test URLs as a signed-in admin
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  ) {
    return new Response(null, { status: 415 })
  }

  if (!(await canManageSettings())) {
    return new Response(null, { status: 403 })
  }

  const body: Partial<Body> | null = await request.json().catch(() => null)
  const { service, mediaServerType, fields } = body ?? {}

  if (
    typeof service !== 'string' ||
    !Object.hasOwn(SECRETS, service) ||
    typeof mediaServerType !== 'string' ||
    !Array.isArray(fields)
  ) {
    return new Response(null, { status: 400 })
  }

  const formData = new FormData()

  for (const field of fields) {
    if (Array.isArray(field) && typeof field[0] === 'string') {
      formData.append(field[0], String(field[1]))
    }
  }

  return Response.json(await testConnection(service, formData, mediaServerType))
}

async function testConnection(
  service: TestedService,
  formData: FormData,
  mediaServerType: string,
): Promise<ConnectionTestResult> {
  const t = await getTranslations('Settings')
  const { connection: data, needsKey } = restoreApiKeys(
    readConnectionForm(formData),
    getSettings().connection,
    SECRETS[service],
  )

  if (needsKey) {
    return {
      status: 'error',
      message: t(needsKey === 'Plex' ? 'reenterToken' : 'reenterApiKey'),
    }
  }

  // Tautulli only tracks Plex
  data.mediaServerType =
    data.statisticsSource === 'tracearr' && isMediaServerType(mediaServerType)
      ? mediaServerType
      : 'plex'

  try {
    const error = await runTest(service, data)

    return error
      ? { status: 'error', message: t(error.key, error.values) }
      : { status: 'success', message: t('Connection.connected') }
  } catch (error) {
    console.error('[CONFIG] - Error testing connection!', error)

    return { status: 'error', message: t('genericError') }
  }
}

async function runTest(
  service: TestedService,
  data: ReturnType<typeof readConnectionForm>,
): Promise<ConnectionError | null> {
  switch (service) {
    case 'tautulli':
      return testTautulli(data.tautulliUrl, data.tautulliApiKey)
    case 'tracearr':
      return (
        (await testTracearr(data.tracearrUrl, data.tracearrApiKey)).error ??
        null
      )
    case 'seerr':
      return testSeerr(data.seerrUrl ?? '', data.seerrApiKey ?? '')
    case 'mediaServer': {
      const url = getMediaServerUrl(data)
      const isPlex = data.mediaServerType === 'plex'

      if (!url) {
        return isPlex && data.plexToken
          ? { key: 'tokenNeedsUrl' }
          : { key: 'enterUrl' }
      }

      const urlError = await testMediaServerUrl(data.mediaServerType, url)

      if (urlError || !isPlex || !data.plexToken) {
        return urlError
      }

      return testPlexToken(url, data.plexToken)
    }
  }
}
