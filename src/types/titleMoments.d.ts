import { TautulliItemRow } from './tautulli'

// A movie, show or artist a story shows as a card
export type TitleCard = {
  item: TautulliItemRow
  type: 'movie' | 'show' | 'artist'
}

// Stories about single titles in the user's plays
export type TitleMoments = {
  // The movie, or an episode, the user watched the most times, from twice up
  comfortWatch:
    | (TitleCard & {
        // The episode's own title, null for a movie
        episode: string | null
        watches: number
      })
    | null
  // Null without movies or shows from at least two decades
  timeTravel: {
    // The decade's first year, such as 1990
    decade: number
    // Of the user's time on movies and shows with a year, from 0 to 1
    share: number
    // An episode's year is when it aired, not when its show started
    oldest: TitleCard & { year: number }
  } | null
  // Shows and artists the user played for the first time in the period. Null
  // until the whole history has been read, or without any.
  discoveries: {
    shows: number
    artists: number
    // The one the user spent the most time on
    top: TitleCard & { duration: string }
  } | null
  // A movie started in the period that the user has never finished. Null
  // until the whole history has been read.
  gaveUp: {
    title: string
    // How far the user got, from 0 to 1
    percent: number
  } | null
}
