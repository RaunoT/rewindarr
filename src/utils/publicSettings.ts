import { PublicSettings, Settings } from '@/types/settings'

export function toPublicSettings(settings: Settings): PublicSettings {
  const { statisticsSource, mediaServerType, seerrUrl, seerrApiKey, complete } =
    settings.connection
  const { excludedUsers: _excludedUsers, ...general } = settings.general
  // Left out, not just hidden, so no address or password reaches the browser
  const { email: _email, ...rest } = settings

  return {
    ...rest,
    connection: {
      statisticsSource,
      mediaServerType,
      seerrUrl: seerrUrl ?? '',
      complete,
      isSeerrActive: !!(seerrUrl && seerrApiKey),
    },
    general,
  }
}
