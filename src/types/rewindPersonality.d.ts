export type PersonalityType =
  | 'nightOwl'
  | 'earlyBird'
  | 'weekendWarrior'
  | 'binger'
  | 'marathoner'
  | 'completionist'
  | 'explorer'
  | 'timeTraveller'
  | 'loyalist'
  | 'cinephile'
  | 'seriesDevotee'
  | 'musicLover'
  // For a viewer who fits none of the others
  | 'freeSpirit'

export type PersonalityMedia = 'shows' | 'movies' | 'audio'

// What earned the viewer their personality. Shares are from 0 to 1, durations
// in seconds.
export type PersonalityStat =
  // 0 to 23, in the viewer's time zone
  | { type: 'peakHour'; hour: number }
  // Of the plays that started from one hour up to another, 0 to 23
  | { type: 'hoursShare'; share: number; from: number; to: number }
  | { type: 'weekendShare'; share: number }
  // 0 is Sunday
  | { type: 'peakDay'; day: number }
  | { type: 'binge'; episodes: number; title: string }
  | { type: 'streak'; days: number }
  | { type: 'completion'; finished: number; started: number }
  | { type: 'newShows'; count: number }
  | { type: 'newArtists'; count: number }
  | { type: 'titles'; count: number }
  | { type: 'decade'; decade: number; share: number }
  | { type: 'oldest'; year: number; title: string }
  // The show is set for an episode
  | {
      type: 'comfortWatch'
      title: string
      show: string | null
      watches: number
    }
  | { type: 'topTitle'; title: string; share: number }
  | { type: 'share'; media: PersonalityMedia; share: number }
  | { type: 'count'; media: PersonalityMedia; count: number }
  | { type: 'total'; duration: number }

// One label that sums up how the viewer watched
export type RewindPersonality = {
  type: PersonalityType
  // Two or three, the one that decided it first
  stats: PersonalityStat[]
}
