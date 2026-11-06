// A grouped get_history row: one play with the sessions it was resumed in
export type TautulliHistoryRow = {
  reference_id: number
  // When the play started, and when its last session started
  started: number
  date: number
  // In seconds, without pauses
  play_duration: number | null
  duration: number | null
  percent_complete: number | null
  media_type: string
  title: string
  grandparent_title: string
  year: number | string | null
  thumb: string
  rating_key: number | string | null
  grandparent_rating_key: number | string | null
  user_id: number
  user_thumb: string
  // Season and episode, as numbers or strings, empty for other media
  parent_media_index: number | string | null
  media_index: number | string | null
  transcode_decision: string | null
}

// get_metadata's, which is empty for an item Plex no longer has
export type TautulliMetadata = {
  thumb?: string
  year?: number | string | null
  // Plex's IDs, like `tmdb://61575`
  guids?: string[]
  // Names, the actors in billing order
  directors?: string[]
  actors?: string[]
  genres?: string[]
}
