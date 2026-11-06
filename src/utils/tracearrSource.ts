import {
  ItemRow,
  MediaServer,
  ServerMembership,
  StatsSource,
} from '@/types/statsSource'
import {
  getTracearrActivity,
  getTracearrFirstPlay,
  getTracearrHistoryReader,
  getTracearrKey,
  getTracearrLibraries,
  getTracearrLibrariesSize,
  getTracearrMedia,
  getTracearrPlays,
  getTracearrServerUsers,
  getTracearrUser,
  getTracearrUsers,
  isTracearrReachable,
} from './fetchTracearr'
import { SourceMediaData } from './getMediaAdditionalData'
import getSettings from './getSettings'
import { fetchMediaServerId } from './mediaServer'
import { getMediaServerUrl } from './mediaServerName'
import {
  createPlayStats,
  filterPlays,
  LIBRARY_PLAY_TYPES,
  toInactiveUserRow,
} from './playStats'
import { getSnapshot, isString, saveSnapshot } from './sourceSnapshot'

// The saved ID stands in while the media server is down
async function getMediaServer(): Promise<MediaServer | null> {
  const connection = getSettings().connection
  const type = connection.mediaServerType
  const url = getMediaServerUrl(connection)

  if (!url) {
    return null
  }

  const key = `${type}|${url}|serverId`
  const fetched = await fetchMediaServerId(type, url)

  if (fetched) {
    void saveSnapshot(key, fetched)
  }

  const serverId = fetched ?? (await getSnapshot(key, isString))

  return serverId ? { type, id: serverId, url } : null
}

async function getServerUser(userId: string): Promise<ServerMembership> {
  const user = await getTracearrUser(userId)

  if (user === null) {
    return { status: 'unavailable' }
  }

  return user
    ? { status: 'member', isAdmin: user.isAdmin }
    : { status: 'notMember' }
}

// Tracearr's plays already carry the poster.
export async function getTracearrMediaData(
  item: ItemRow,
): Promise<SourceMediaData> {
  return {
    thumb: item.thumb,
    ...(await getTracearrMedia(item.media_id)),
  }
}

async function getTracearrInactiveUser(
  userId: string,
): Promise<ItemRow | null> {
  const users = await getTracearrUsers()
  const user = users.find((user) => user.user_id === userId)

  // A user Tracearr doesn't list would get an empty row in the rankings
  if (!user) {
    return null
  }

  return toInactiveUserRow(user)
}

// Tracearr's libraries each span every library of a media type
const playStats = createPlayStats({
  getPlays: async (since, libraries) =>
    filterPlays(await getTracearrPlays(since), {
      since,
      mediaTypes: libraries?.map(
        (library) => LIBRARY_PLAY_TYPES[library.section_type],
      ),
    }),
  getUsers: getTracearrServerUsers,
  getMediaData: getTracearrMediaData,
})
const tracearrSource: StatsSource = {
  ...playStats,
  getMediaServer,
  // Tracearr doesn't know which libraries are shared with a user.
  getLibraries: getTracearrLibraries,
  getLibrariesSize: getTracearrLibrariesSize,
  getUsers: getTracearrUsers,
  getServerUser,
  getActivity: getTracearrActivity,
  getInactiveUser: getTracearrInactiveUser,
  getFirstPlay: getTracearrFirstPlay,
  getHistoryReaders: async () => [getTracearrHistoryReader()],
  isReachable: isTracearrReachable,
  getSnapshotKey: getTracearrKey,
}

export default tracearrSource
