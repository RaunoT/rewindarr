'use server'

import { canManageSettings } from '@/lib/access'
import { MediaServerType } from '@/types/settings'
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

export type TestedService = 'tautulli' | 'tracearr' | 'mediaServer' | 'seerr'

export type ConnectionTestResult = {
  status: 'success' | 'error'
  message: string
}

const SECRETS: Record<TestedService, SecretService[]> = {
  tautulli: ['Tautulli'],
  tracearr: ['Tracearr'],
  mediaServer: ['Plex'],
  seerr: ['Seerr'],
}

// Tests one service with what's in the form, without saving it. Null for
// anyone who can't manage the settings.
export async function testConnection(
  service: TestedService,
  formData: FormData,
  // The form knows which server Tracearr's chosen one is
  mediaServerType: MediaServerType,
): Promise<ConnectionTestResult | null> {
  if (!Object.hasOwn(SECRETS, service) || !(await canManageSettings())) {
    return null
  }

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
