import { DEFAULT_SETTINGS } from '@/utils/constants'
import { cloneDeep } from 'lodash'
import { describe, expect, it } from 'vitest'
import { toPublicSettings } from './publicSettings'

describe('toPublicSettings', () => {
  it('removes connection secrets and excluded users from public settings', () => {
    const settings = cloneDeep(DEFAULT_SETTINGS)

    settings.connection.tautulliUrl = 'http://tautulli.local:8181'
    settings.connection.tautulliApiKey = 'secret-tautulli-key'
    settings.connection.tracearrUrl = 'http://tracearr.local:3000'
    settings.connection.tracearrApiKey = 'secret-tracearr-key'
    settings.connection.tracearrServerId = 'srv-1'
    settings.connection.tracearrOtherServerIds = ['srv-2']
    settings.connection.plexUrl = 'http://plex.local:32400'
    settings.connection.plexToken = 'secret-plex-token'
    settings.connection.jellyfinUrl = 'http://jellyfin.local:8096'
    settings.connection.seerrUrl = 'https://seerr.example.com'
    settings.connection.seerrApiKey = 'secret-seerr-key'
    settings.general.serverName = 'Home Cinema'
    settings.general.excludedUsers = ['42', '99']

    const result = toPublicSettings(settings)

    expect(result.connection).toEqual({
      statisticsSource: 'tautulli',
      mediaServerType: 'plex',
      seerrUrl: 'https://seerr.example.com',
      complete: false,
      isSeerrActive: true,
    })
    expect('excludedUsers' in result.general).toBe(false)
    expect(result.general.serverName).toBe('Home Cinema')
    expect(settings.general.excludedUsers).toEqual(['42', '99'])
  })

  it('reports Seerr as inactive when either url or api key is missing', () => {
    const settings = cloneDeep(DEFAULT_SETTINGS)

    settings.connection.seerrUrl = 'https://seerr.example.com'
    settings.connection.seerrApiKey = ''

    expect(toPublicSettings(settings).connection.isSeerrActive).toBe(false)
  })
})
