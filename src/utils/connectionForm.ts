import { ConnectionSettings, StatisticsSource } from '@/types/settings'
import getSettings from './getSettings'
import { normalizeUrl } from './url'

// The connection settings form as sent, before its saved keys are restored
export function readConnectionForm(formData: FormData): ConnectionSettings {
  return {
    statisticsSource: formData.get('statisticsSource') as StatisticsSource,
    tautulliUrl: normalizeUrl(formData.get('tautulliUrl') as string),
    tautulliApiKey: formData.get('tautulliApiKey') as string,
    tracearrUrl: normalizeUrl(formData.get('tracearrUrl') as string),
    tracearrApiKey: formData.get('tracearrApiKey') as string,
    tracearrServerId: (formData.get('tracearrServerId') as string | null) ?? '',
    tracearrOtherServerIds: formData.getAll(
      'tracearrOtherServerIds',
    ) as string[],
    seerrUrl: normalizeUrl(formData.get('seerrUrl') as string),
    seerrApiKey: formData.get('seerrApiKey') as string,
    // Tautulli only tracks Plex. Tracearr's is set from the chosen server.
    mediaServerType: getSettings().connection.mediaServerType,
    plexUrl: normalizeUrl(formData.get('plexUrl') as string),
    plexToken: ((formData.get('plexToken') as string | null) ?? '').trim(),
    jellyfinUrl: normalizeUrl(formData.get('jellyfinUrl') as string),
    complete: true,
  }
}
