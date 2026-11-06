import {
  ConnectionSettings,
  GeneralSettings,
  MediaServerType,
} from '@/types/settings'

const SERVER_NAMES: Record<MediaServerType, string> = {
  plex: 'Plex',
  jellyfin: 'Jellyfin',
}

export function getMediaServerName(type: MediaServerType): string {
  return SERVER_NAMES[type]
}

// The name the settings give the server, else its media server's
export function getServerName(settings: {
  general: Pick<GeneralSettings, 'serverName'>
  connection: Pick<ConnectionSettings, 'mediaServerType'>
}): string {
  return (
    settings.general.serverName ||
    getMediaServerName(settings.connection.mediaServerType)
  )
}

export function getMediaServerUrl(
  connection: Pick<
    ConnectionSettings,
    'mediaServerType' | 'plexUrl' | 'jellyfinUrl'
  >,
): string {
  return connection.mediaServerType === 'jellyfin'
    ? connection.jellyfinUrl
    : connection.plexUrl
}

export function isMediaServerType(type: string): type is MediaServerType {
  return type in SERVER_NAMES
}
