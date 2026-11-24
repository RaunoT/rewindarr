'use server'

import { denySettingsAccess } from '@/lib/access'
import {
  ConnectionSettings,
  GeneralSettings,
  SettingsFormInitialState,
} from '@/types/settings'
import { ConnectionError } from '@/utils/connectionErrors'
import { readConnectionForm } from '@/utils/connectionForm'
import { maskApiKeys, restoreApiKeys } from '@/utils/connectionSecrets'
import {
  testMediaServerUrl,
  testPlexToken,
  testSeerr,
  testTautulli,
  testTracearr,
} from '@/utils/connectionTests'
import {
  selectOtherServers,
  selectServer,
  toServerOptions,
} from '@/utils/fetchTracearr'
import getSettings from '@/utils/getSettings'
import { getLibrarySlug } from '@/utils/helpers'
import { getMediaServerName, getMediaServerUrl } from '@/utils/mediaServerName'
import { getReachableLibraries, startHistoryRead } from '@/utils/statsSource'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import updateSettings from '../../_actions/updateSettings'

const httpUrl = z
  .string()
  .url()
  .regex(/^https?:\/\//i)
// Only the selected statistics source has to be filled in.
const baseSchema = z.object({
  tautulliUrl: httpUrl.or(z.literal('')),
  tautulliApiKey: z.string(),
  tracearrUrl: httpUrl.or(z.literal('')),
  tracearrApiKey: z.string(),
  tracearrServerId: z.string(),
  tracearrOtherServerIds: z.array(z.string()),
  seerrUrl: httpUrl.optional().or(z.literal('')),
  seerrApiKey: z.string().optional(),
  mediaServerType: z.enum(['plex', 'jellyfin']),
  plexUrl: httpUrl.or(z.literal('')),
  jellyfinUrl: httpUrl.or(z.literal('')),
  plexToken: z.string().optional(),
  complete: z.boolean(),
})
const schema = z.discriminatedUnion('statisticsSource', [
  baseSchema.extend({
    statisticsSource: z.literal('tautulli'),
    tautulliUrl: httpUrl,
  }),
  baseSchema.extend({
    statisticsSource: z.literal('tracearr'),
    tracearrUrl: httpUrl,
    tracearrApiKey: z.string().min(1),
  }),
])
// The saved general settings are already valid, only `complete` is flipped.
const generalSchema = z.custom<GeneralSettings>(
  (value) => typeof (value as GeneralSettings)?.complete === 'boolean',
)

export default async function saveConnectionSettings(
  prevState: SettingsFormInitialState<ConnectionSettings>,
  formData: FormData,
) {
  const state = await testAndSave(prevState, formData)

  return {
    ...state,
    fields: maskApiKeys(state.fields, getSettings().connection),
  }
}

async function testAndSave(
  prevState: SettingsFormInitialState<ConnectionSettings>,
  formData: FormData,
) {
  const denied = await denySettingsAccess(prevState)

  if (denied) {
    return denied
  }

  const submitted = readConnectionForm(formData)
  const t = await getTranslations('Settings')
  const { connection: data, needsKey } = restoreApiKeys(
    submitted,
    getSettings().connection,
  )

  if (needsKey) {
    return {
      message: `${needsKey} - ${t(needsKey === 'Plex' ? 'reenterToken' : 'reenterApiKey')}`,
      status: 'error',
      fields: data,
    }
  }

  const fail = (service: string, { key, values }: ConnectionError) => ({
    message: `${service} - ${t(key, values)}`,
    status: 'error',
    fields: data,
  })

  try {
    if (data.statisticsSource === 'tracearr') {
      const { servers, error } = await testTracearr(
        data.tracearrUrl,
        data.tracearrApiKey,
      )

      if (error) {
        return fail('Tracearr', error)
      }

      const server = selectServer(servers, data.tracearrServerId)

      if (!server) {
        return {
          message: `Tracearr - ${t('chooseMediaServer')}`,
          status: 'error',
          fields: data,
          tracearrServers: toServerOptions(servers),
        }
      }

      data.tracearrServerId = server.server_id
      // Without the chosen one, and any that's gone from Tracearr
      data.tracearrOtherServerIds = selectOtherServers(
        servers,
        server,
        data.tracearrOtherServerIds,
      ).map(({ server_id }) => server_id)
      data.mediaServerType =
        server.server_type === 'jellyfin' ? 'jellyfin' : 'plex'
    } else {
      data.mediaServerType = 'plex'

      const error = await testTautulli(data.tautulliUrl, data.tautulliApiKey)

      if (error) {
        return fail('Tautulli', error)
      }
    }

    if (data.seerrUrl || data.seerrApiKey) {
      const error = await testSeerr(data.seerrUrl ?? '', data.seerrApiKey ?? '')

      if (error) {
        return fail('Seerr', error)
      }
    }

    // Tautulli finds the Plex server itself, so only Tracearr's needs one
    if (data.statisticsSource === 'tracearr') {
      const serverName = getMediaServerName(data.mediaServerType)
      const serverUrl = getMediaServerUrl(data)

      if (data.mediaServerType === 'jellyfin' && !serverUrl) {
        return fail(serverName, { key: 'mediaServerUrlRequired' })
      }

      if (serverUrl) {
        const error = await testMediaServerUrl(data.mediaServerType, serverUrl)

        if (error) {
          return fail(serverName, error)
        }
      }
    }

    // Jellyfin keeps the token for switching back, but has no use for it
    if (data.mediaServerType === 'plex' && data.plexToken) {
      const error = await testPlexToken(data.plexUrl, data.plexToken)

      if (error) {
        return fail('Plex', error)
      }
    }
  } catch (error) {
    console.error('[CONFIG] - Error testing connection!', error)

    return {
      message: t('genericError'),
      status: 'error',
      fields: data,
    }
  }

  const previousSettings = getSettings()
  const isSourceSwitch =
    previousSettings.connection.statisticsSource !== data.statisticsSource &&
    previousSettings.general.complete &&
    schema.safeParse(data).success

  // Libraries are matched by name, which differs between the sources, so the
  // old source's are cleared. General is marked incomplete first, so a failed
  // write never leaves the new source saved with the old libraries set up.
  if (isSourceSwitch) {
    const generalResult = await updateSettings(
      generalSchema,
      { ...previousSettings.general, activeLibraries: [], complete: false },
      'general',
    )

    if (generalResult.status !== 'success') {
      return { ...generalResult, fields: data }
    }
  }

  const result = await updateSettings(schema, data, 'connection')

  if (result.status !== 'success') {
    return result
  }

  startHistoryRead()

  if (!isSourceSwitch) {
    return result
  }

  // While General is incomplete, the result leads there to pick libraries
  return (
    (await activateAllLibraries(data, t)) ?? {
      ...result,
      message: t('savedChooseLibraries'),
    }
  )
}

// The new source starts with every library on, like a first setup, so a
// switch doesn't need General saved again. Null when its libraries can't be
// read, which leaves picking them to General.
async function activateAllLibraries(
  data: ConnectionSettings,
  t: Awaited<ReturnType<typeof getTranslations<'Settings'>>>,
) {
  const libraries = await getReachableLibraries(false)

  if (!libraries?.length) {
    return null
  }

  const result = await updateSettings(
    generalSchema,
    {
      ...getSettings().general,
      activeLibraries: libraries.map((library) => getLibrarySlug(library)),
      complete: true,
    },
    'general',
  )

  return result.status === 'success'
    ? { message: t('savedLibrariesActive'), status: 'success', fields: data }
    : null
}
