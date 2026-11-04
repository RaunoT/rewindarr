import { Play } from '@/types/playHistory'
import { UserRewind } from '@/types/rewind'
import {
  PersonalityMedia,
  PersonalityStat,
  PersonalityType,
  RewindPersonality,
} from '@/types/rewindPersonality'
import { maxBy, sum, sumBy } from 'lodash'
import { groupPlays, isCountedPlay } from './playStats'
import { GAVE_UP_AFTER_MS, MIN_GAVE_UP_MS } from './titleMoments'

// Below these, there's too little to tell how the viewer watches
const MIN_PLAYS = 10
const MIN_DURATION = 3 * 60 * 60
// The hours and days need more plays before their pattern means anything
const MIN_TIMED_PLAYS = 20
// From 22:00 up to 04:00, and from 05:00 up to 10:00
const NIGHT_HOURS = [22, 23, 0, 1, 2, 3]
const MORNING_HOURS = [5, 6, 7, 8, 9]
const WEEKEND_DAYS = [0, 6]
const VIDEO_MEDIA: PersonalityMedia[] = ['shows', 'movies']

// What the rules read, from the viewer's stats in the period
export type PersonalitySignals = {
  // In seconds, null without a library of the type
  durations: Record<PersonalityMedia, number | null>
  // The plays that count
  counts: Record<PersonalityMedia, number>
  // Plays per hour (0 to 23) and day of the week (0 is Sunday), in the
  // viewer's time zone
  hourly: number[]
  daily: number[]
  binge: { episodes: number; title: string } | null
  // Days in a row
  streak: number | null
  // Movies with enough time on them not to be a misclick
  movies: { started: number; finished: number }
  // Movies, shows and artists with a play that counts
  titles: number
  // Null until the whole history has been read
  discoveries: { shows: number; artists: number } | null
  timeTravel: {
    decade: number
    // Of the time on movies and shows with a year, from 0 to 1
    share: number
    oldest: { year: number; title: string }
  } | null
  comfortWatch: { title: string; show: string | null; watches: number } | null
  // The movie, show or artist with the most of the viewer's time, in seconds
  topTitle: { title: string; duration: number } | null
}

// The part of the signals read from the plays themselves
export type PlaySignals = Pick<PersonalitySignals, 'movies' | 'titles'>

type Match = {
  // From 0, just past the threshold, to 1, strong
  strength: number
  stats: PersonalityStat[]
}

type Rule = {
  type: Exclude<PersonalityType, 'freeSpirit'>
  match: (signals: PersonalitySignals, year: number) => Match | null
}

// How far a signal is past its threshold, from 0 there to 1 where it's strong.
// Strong signals all count the same, so a rule's place in the list settles a
// tie between them.
function getStrength(
  value: number,
  threshold: number,
  strong: number,
): number | null {
  return value < threshold
    ? null
    : Math.min(1, (value - threshold) / (strong - threshold))
}

// A signal past its threshold beats one that isn't, so the stat that decided
// a personality comes first
function isStronger(strength: number | null, other: number | null): boolean {
  return (strength ?? -1) > (other ?? -1)
}

function toMatch(
  strength: number | null,
  stats: PersonalityStat[],
): Match | null {
  return strength === null ? null : { strength, stats }
}

function getTotalDuration({ durations }: PersonalitySignals): number {
  return sum(Object.values(durations).map((duration) => duration ?? 0))
}

// The hour or day with the most plays, the first of a tie, like the habits
// stories have it
function getPeak(totals: number[]): number | null {
  const peak = Math.max(0, ...totals)

  return peak > 0 ? totals.indexOf(peak) : null
}

// The share of the plays in some of the hours or days, when the busiest one
// is among them, so the stats agree with the habits stories
function getHabitShare(
  totals: number[],
  indexes: number[],
): { share: number; peak: number } | null {
  const plays = sum(totals)
  const peak = getPeak(totals)

  if (plays < MIN_TIMED_PLAYS || peak === null || !indexes.includes(peak)) {
    return null
  }

  return {
    share: sum(indexes.map((index) => totals[index] ?? 0)) / plays,
    peak,
  }
}

// The plays in some hours of the day, when the busiest hour is among them
function matchHours(
  hourly: number[],
  hours: number[],
  threshold: number,
  strong: number,
): Match | null {
  const habit = getHabitShare(hourly, hours)

  return (
    habit &&
    toMatch(getStrength(habit.share, threshold, strong), [
      {
        type: 'hoursShare',
        share: habit.share,
        from: hours[0],
        to: (hours[hours.length - 1] + 1) % 24,
      },
      { type: 'peakHour', hour: habit.peak },
    ])
  )
}

// Time on one kind of media says something only when the server has movies or
// shows besides it
function matchMedia(
  signals: PersonalitySignals,
  media: PersonalityMedia,
  minCount: number,
  threshold: number,
  strong: number,
): Match | null {
  const share = (signals.durations[media] ?? 0) / getTotalDuration(signals)
  const count = signals.counts[media]
  const hasOtherVideo = VIDEO_MEDIA.some(
    (other) => other !== media && signals.durations[other] !== null,
  )

  return count < minCount || !hasOtherVideo
    ? null
    : toMatch(getStrength(share, threshold, strong), [
        { type: 'share', media, share },
        { type: 'count', media, count },
      ])
}

// In order of how rare and telling they are, which settles a tie
const RULES: Rule[] = [
  {
    type: 'timeTraveller',
    match: ({ timeTravel }, year) => {
      // The favourite decade has to be at least two before the current one
      if (!timeTravel || timeTravel.decade > Math.floor(year / 10) * 10 - 20) {
        return null
      }

      return toMatch(getStrength(timeTravel.share, 0.35, 0.6), [
        {
          type: 'decade',
          decade: timeTravel.decade,
          share: timeTravel.share,
        },
        { type: 'oldest', ...timeTravel.oldest },
      ])
    },
  },
  {
    type: 'nightOwl',
    match: ({ hourly }) => matchHours(hourly, NIGHT_HOURS, 0.35, 0.6),
  },
  {
    type: 'earlyBird',
    match: ({ hourly }) => matchHours(hourly, MORNING_HOURS, 0.3, 0.5),
  },
  {
    type: 'completionist',
    match: (signals) => {
      const { movies } = signals
      const rate = movies.started && movies.finished / movies.started
      const rateStrength = getStrength(rate, 0.95, 1)
      // Finishing a handful of movies says little
      const countStrength = getStrength(movies.started, 10, 25)

      return rateStrength === null || countStrength === null
        ? null
        : toMatch(Math.min(rateStrength, countStrength), [
            { type: 'completion', ...movies },
            { type: 'total', duration: getTotalDuration(signals) },
          ])
    },
  },
  {
    type: 'binger',
    match: ({ binge, counts }) =>
      binge &&
      toMatch(getStrength(binge.episodes, 8, 16), [
        { type: 'binge', ...binge },
        { type: 'count', media: 'shows', count: counts.shows },
      ]),
  },
  {
    type: 'explorer',
    match: ({ discoveries, titles }) => {
      if (!discoveries) {
        return null
      }

      // Music is quicker to try, so it takes more artists than shows
      const showsStrength = getStrength(discoveries.shows, 6, 15)
      const artistsStrength = getStrength(discoveries.artists, 20, 60)
      // A kind without any finds is left out
      const shows: PersonalityStat[] = discoveries.shows
        ? [{ type: 'newShows', count: discoveries.shows }]
        : []
      const artists: PersonalityStat[] = discoveries.artists
        ? [{ type: 'newArtists', count: discoveries.artists }]
        : []

      if (showsStrength === null && artistsStrength === null) {
        return null
      }

      return {
        strength: Math.max(showsStrength ?? 0, artistsStrength ?? 0),
        stats: [
          ...(isStronger(artistsStrength, showsStrength)
            ? [...artists, ...shows]
            : [...shows, ...artists]),
          { type: 'titles', count: titles },
        ],
      }
    },
  },
  {
    type: 'weekendWarrior',
    match: ({ daily }) => {
      const weekend = getHabitShare(daily, WEEKEND_DAYS)

      return (
        weekend &&
        toMatch(getStrength(weekend.share, 0.5, 0.75), [
          { type: 'weekendShare', share: weekend.share },
          { type: 'peakDay', day: weekend.peak },
        ])
      )
    },
  },
  {
    type: 'loyalist',
    match: (signals) => {
      const { topTitle, comfortWatch } = signals

      if (!topTitle) {
        return null
      }

      const share = topTitle.duration / getTotalDuration(signals)
      const topStrength = getStrength(share, 0.3, 0.6)
      const comfortStrength = comfortWatch
        ? getStrength(comfortWatch.watches, 3, 6)
        : null
      const top: PersonalityStat = {
        type: 'topTitle',
        title: topTitle.title,
        share,
      }
      const comfort: PersonalityStat | null = comfortWatch && {
        type: 'comfortWatch',
        ...comfortWatch,
      }

      if (topStrength === null && comfortStrength === null) {
        return null
      }

      return {
        strength: Math.max(topStrength ?? 0, comfortStrength ?? 0),
        stats:
          comfort && isStronger(comfortStrength, topStrength)
            ? [comfort, top]
            : [
                top,
                comfort ?? {
                  type: 'total',
                  duration: getTotalDuration(signals),
                },
              ],
      }
    },
  },
  {
    type: 'marathoner',
    match: (signals) =>
      signals.streak === null
        ? null
        : toMatch(getStrength(signals.streak, 14, 45), [
            { type: 'streak', days: signals.streak },
            { type: 'total', duration: getTotalDuration(signals) },
          ]),
  },
  {
    type: 'musicLover',
    match: (signals) => matchMedia(signals, 'audio', 50, 0.35, 0.7),
  },
  {
    type: 'cinephile',
    match: (signals) => matchMedia(signals, 'movies', 10, 0.5, 0.8),
  },
  // Shows take up most people's time, so it takes nearly all of it
  {
    type: 'seriesDevotee',
    match: (signals) => matchMedia(signals, 'shows', 30, 0.8, 0.95),
  },
]

// The personality whose signal is the strongest. Null for a viewer with too
// little to go on.
export function getPersonality(
  signals: PersonalitySignals,
  year = new Date().getFullYear(),
): RewindPersonality | null {
  const totalDuration = getTotalDuration(signals)

  if (
    sum(Object.values(signals.counts)) < MIN_PLAYS ||
    totalDuration < MIN_DURATION
  ) {
    return null
  }

  let best: (Match & { type: PersonalityType }) | null = null

  for (const rule of RULES) {
    const match = rule.match(signals, year)

    // Only a stronger one takes over, so the earlier rule wins a tie
    if (match && (!best || match.strength > best.strength)) {
      best = { type: rule.type, ...match }
    }
  }

  return best
    ? { type: best.type, stats: best.stats }
    : {
        type: 'freeSpirit',
        stats: [
          { type: 'total', duration: totalDuration },
          { type: 'titles', count: signals.titles },
        ],
      }
}

// The movies the viewer started in the period and how many of them they
// finished, as the story about a movie they gave up on counts them, and how
// many titles they played
export function getPlaySignals(
  plays: Play[],
  minPercent: number,
  now = Date.now(),
): PlaySignals {
  const isCounted = (play: Play) => isCountedPlay(play, minPercent)
  const movies = groupPlays(
    plays.filter((play) => play.mediaType === 'movie'),
  ).filter((group) => sumBy(group, 'durationMs') >= MIN_GAVE_UP_MS)
  const finished = movies.filter((group) => group.some(isCounted))
  // One played lately may still be finished
  const unfinished = movies.filter(
    (group) =>
      !group.some(isCounted) &&
      now - Math.max(...group.map((play) => play.startedAt)) >=
        GAVE_UP_AFTER_MS,
  )

  return {
    movies: {
      started: finished.length + unfinished.length,
      finished: finished.length,
    },
    titles: groupPlays(plays.filter(isCounted)).length,
  }
}

// The signals from the stats the stories show, and those from the plays
export function getPersonalitySignals(
  rewind: Pick<
    UserRewind,
    'shows' | 'movies' | 'audio' | 'habits' | 'moments' | 'titleMoments'
  >,
  playSignals: PlaySignals,
): PersonalitySignals {
  const { shows, movies, audio, habits, moments, titleMoments } = rewind
  const { comfortWatch, timeTravel, discoveries } = titleMoments
  const topTitle = maxBy(
    [shows.top[0], movies.top[0], audio.top[0]].filter((item) => !!item),
    'total_duration',
  )

  return {
    durations: {
      shows: shows.duration_value,
      movies: movies.duration_value,
      audio: audio.duration_value,
    },
    counts: {
      shows: shows.count,
      movies: movies.count,
      audio: audio.count,
    },
    hourly: habits.hourly,
    daily: habits.daily,
    binge: moments.binge && {
      episodes: moments.binge.episodes,
      title: moments.binge.title,
    },
    streak: moments.streak?.days ?? null,
    ...playSignals,
    discoveries: discoveries && {
      shows: discoveries.shows,
      artists: discoveries.artists,
    },
    timeTravel: timeTravel && {
      decade: timeTravel.decade,
      share: timeTravel.share,
      oldest: {
        year: timeTravel.oldest.year,
        title: timeTravel.oldest.item.title,
      },
    },
    comfortWatch: comfortWatch && {
      title: comfortWatch.episode ?? comfortWatch.item.title,
      show: comfortWatch.episode && comfortWatch.item.title,
      watches: comfortWatch.watches,
    },
    topTitle: topTitle
      ? { title: topTitle.title, duration: topTitle.total_duration }
      : null,
  }
}
