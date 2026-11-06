import { ItemRow } from '@/types/statsSource'

// A movie or show as a card, with the plays, time and people the story counts
export type SocialItem = {
  data: ItemRow
  type: 'movie' | 'show'
}

// How the user's year compares with everyone else's, without naming anyone
export type RewindSocial = {
  // The titles the user watched that nobody else did. Null without any, or
  // when nobody else watched anything.
  onlyYou: {
    count: number
    // Of the titles the user watched, from 0 to 1
    share: number
    // The one the user spent the most time on, with the user's own plays
    item: SocialItem
  } | null
  // Who else watched what the user asked for in Seerr. Null without Seerr, or
  // when nobody else watched any of it.
  requestsReach: {
    // Other people
    users: number
    // The user's requests that someone else watched
    requests: number
    // Their time on them
    duration: string
    // The request the most of them watched, with how many did
    item: SocialItem
    // Whether the user watched it too
    isItemWatched: boolean
  } | null
  // Everyone's year together. Null when nobody else played anything.
  serverYear: {
    duration: string
    // Who has a play that counts, the user included
    users: number
    // The user's part of the time, from 0 to 1
    share: number
    // The most watched by people, then by plays and watch time, with
    // everyone's totals. Null without any.
    movie: SocialItem | null
    show: SocialItem | null
  } | null
}
