'use client'

import usePromiseValue from '@/hooks/usePromiseValue'
import {
  RewindPeriod,
  RewindTotals,
  RewindUser,
  UserRewind,
} from '@/types/rewind'
import { PublicSettings } from '@/types/settings'
import { RewindStoryId } from '@/utils/constants'
import { hasRewindPlays } from '@/utils/helpers'
import { FC } from 'react'
import Snow from './Snow'
import Stories, { Story } from './Stories'
import StoryAudio from './Stories/Audio'
import StoryAudioTop from './Stories/AudioTop'
import StoryBiggestDay from './Stories/BiggestDay'
import StoryBinge from './Stories/Binge'
import StoryComfortWatch from './Stories/ComfortWatch'
import StoryDiscoveries from './Stories/Discoveries'
import StoryFirstPlay from './Stories/FirstPlay'
import StoryGoodbye from './Stories/Goodbye'
import StoryHabitsDay from './Stories/HabitsDay'
import StoryHabitsHour from './Stories/HabitsHour'
import StoryLibraries from './Stories/Libraries'
import StoryMonths from './Stories/Months'
import StoryMovies from './Stories/Movies'
import StoryMoviesActors from './Stories/MoviesActors'
import StoryMoviesDirectors from './Stories/MoviesDirectors'
import StoryMoviesGenres from './Stories/MoviesGenres'
import StoryMoviesTop from './Stories/MoviesTop'
import StoryOnlyYou from './Stories/OnlyYou'
import StoryPersonality from './Stories/Personality'
import StoryRequests from './Stories/Requests'
import StoryRequestsReach from './Stories/RequestsReach'
import StoryServerYear from './Stories/ServerYear'
import StoryShows from './Stories/Shows'
import StoryShowsActors from './Stories/ShowsActors'
import StoryShowsGenres from './Stories/ShowsGenres'
import StoryShowsTop from './Stories/ShowsTop'
import StorySummary from './Stories/Summary'
import StoryTasteMatch from './Stories/TasteMatch'
import StoryTimeTravel from './Stories/TimeTravel'
import StoryTotal from './Stories/Total'
import StoryUsersTop from './Stories/UsersTop'
import StoryWelcome from './Stories/Welcome'
import StoryYearOverYear from './Stories/YearOverYear'
import { getStoryArt } from './storyArt'
import {
  BINGE_SHOW_STEP,
  getCountdownMusic,
  StepMusic,
  STORY_TITLES,
  TITLE_STEPS,
  TitleSlot,
  TOP_TITLE_STEP,
} from './storyMusic'
import { joinStorySections, removeHiddenStories } from './storySections'

type StoryComponent = {
  userRewind: UserRewind
  settings: PublicSettings
}

export type RewindThemes = {
  // The top shows' and top movies' theme songs, in their order, each best
  // first
  showThemes: string[][]
  movieThemes: string[][]
  // The theme songs of each top person's most watched title, in their order
  showActorThemes: string[][]
  movieActorThemes: string[][]
  directorThemes: string[][]
  // The binged show's theme songs, best first
  bingeThemes: string[]
  // The theme songs of the titles the other stories name, or an artist's
  // most played track
  titleThemes: Record<TitleSlot, string[]>
  // The viewer's most played track, from the media server or a preview of it
  topTrack: string[]
  // The top artists' most played tracks, in their order
  artistTracks: string[][]
}

// What the stories after the total show, which takes the longest to read
export type RewindData = {
  userRewind: UserRewind
  themes: RewindThemes
}

type Props = {
  user: RewindUser
  period: RewindPeriod
  settings: PublicSettings
  // The admin's own track, which every story falls back to
  track: string | null
  // Read while the welcome shows, the total first
  totals: Promise<RewindTotals>
  rewind: Promise<RewindData>
}

export default function RewindStories({
  user,
  period,
  settings,
  track,
  totals: totalsRequest,
  rewind: rewindRequest,
}: Props) {
  const totals = usePromiseValue(totalsRequest)
  const rewind = usePromiseValue(rewindRequest)
  const music = track ? [track] : []
  const welcome: Story = {
    id: 'welcome',
    type: 'component',
    component: () => (
      <StoryWelcome userRewind={{ user, period }} settings={settings} />
    ),
    music,
  }
  // Its place is known before its numbers are
  const total: Story = totals
    ? {
        id: 'total',
        type: 'component',
        component: () => <StoryTotal userRewind={totals} settings={settings} />,
        music,
      }
    : { id: 'total', type: 'loading', music }
  const stories = removeHiddenStories(
    joinStorySections<Story>(
      [[welcome], [total], rewind ? getStories(rewind, settings, track) : null],
      { id: 'more', type: 'loading', music },
    ),
    settings.rewind.hiddenStories,
  )

  return (
    <>
      {settings.rewind.isSnowActive && <Snow />}
      <Stories stories={stories} />
    </>
  )
}

// The stories after the total, the ones without anything to show left out
function getStories(
  { userRewind, themes: music }: RewindData,
  settings: PublicSettings,
  track: string | null,
): Story[] {
  function createStory(
    id: RewindStoryId | 'goodbye',
    Component: FC<StoryComponent>,
  ): Story {
    return {
      id,
      type: 'component',
      component: () => (
        <Component userRewind={userRewind} settings={settings} />
      ),
      music: withTrack(),
      stepMusic: getTitleMusic(id),
      art: getStoryArt(id, userRewind),
    }
  }

  // The track also stands in for a title without a theme song
  function withTrack(themes: string[] = []): string[] {
    return track ? [...themes, track] : themes
  }

  // A title's theme song, or an artist's track, only plays once the story
  // shows it, and the top lists play each one's as its place shows
  function getTitleMusic(id: RewindStoryId | 'goodbye'): StepMusic[] {
    switch (id) {
      case 'shows':
        return [{ step: TOP_TITLE_STEP, music: withTrack(music.showThemes[0]) }]
      case 'movies':
        return [
          { step: TOP_TITLE_STEP, music: withTrack(music.movieThemes[0]) },
        ]
      case 'shows_top':
        return getCountdownMusic(
          userRewind.shows.top.map((_, i) => withTrack(music.showThemes[i])),
        )
      case 'movies_top':
        return getCountdownMusic(
          userRewind.movies.top.map((_, i) => withTrack(music.movieThemes[i])),
        )
      case 'shows_actors':
        return getPeopleMusic(
          userRewind.people.showActors,
          music.showActorThemes,
        )
      case 'movies_actors':
        return getPeopleMusic(
          userRewind.people.movieActors,
          music.movieActorThemes,
        )
      case 'movies_directors':
        return getPeopleMusic(userRewind.people.directors, music.directorThemes)
      case 'binge':
        return [{ step: BINGE_SHOW_STEP, music: withTrack(music.bingeThemes) }]
      case 'audio':
        return [
          {
            step: TOP_TITLE_STEP,
            // Without a top track, the story names the top artist
            music: withTrack(
              userRewind.audio.topTrack
                ? music.topTrack
                : music.artistTracks[0],
            ),
          },
        ]
      case 'audio_top':
        return getCountdownMusic(
          userRewind.audio.top.map((_, i) => withTrack(music.artistTracks[i])),
        )
      default:
        return (STORY_TITLES[id as RewindStoryId] ?? []).map((slot) => ({
          step: TITLE_STEPS[slot],
          music: withTrack(music.titleThemes[slot]),
        }))
    }
  }

  // Each person plays their most watched title's theme song as they show
  function getPeopleMusic(people: unknown[], themes: string[][]): StepMusic[] {
    return getCountdownMusic(people.map((_, i) => withTrack(themes[i])))
  }

  const isSeerrActive = settings.connection.isSeerrActive
  const hasMovieLibraries = userRewind.libraries.some(
    (library) => library.section_type === 'movie',
  )
  const hasShowLibraries = userRewind.libraries.some(
    (library) => library.section_type === 'show',
  )
  const hasAudioLibraries = userRewind.libraries.some(
    (library) => library.section_type === 'artist',
  )

  return [
    ...(userRewind.moments.monthly ? [createStory('months', StoryMonths)] : []),
    ...(userRewind.yearOverYear
      ? [createStory('year_over_year', StoryYearOverYear)]
      : []),
    ...(userRewind.duration.user && hasShowLibraries && userRewind.shows.top[0]
      ? [createStory('shows', StoryShows)]
      : []),
    ...(userRewind.shows.top.length > 1 && hasShowLibraries
      ? [createStory('shows_top', StoryShowsTop)]
      : []),
    ...(userRewind.people.showActors.length && hasShowLibraries
      ? [createStory('shows_actors', StoryShowsActors)]
      : []),
    ...(userRewind.genres.shows.length && hasShowLibraries
      ? [createStory('shows_genres', StoryShowsGenres)]
      : []),
    ...(userRewind.duration.user &&
    hasMovieLibraries &&
    userRewind.movies.top[0]
      ? [createStory('movies', StoryMovies)]
      : []),
    ...(userRewind.movies.top.length > 1 && hasMovieLibraries
      ? [createStory('movies_top', StoryMoviesTop)]
      : []),
    ...(userRewind.people.directors.length && hasMovieLibraries
      ? [createStory('movies_directors', StoryMoviesDirectors)]
      : []),
    ...(userRewind.people.movieActors.length && hasMovieLibraries
      ? [createStory('movies_actors', StoryMoviesActors)]
      : []),
    ...(userRewind.genres.movies.length && hasMovieLibraries
      ? [createStory('movies_genres', StoryMoviesGenres)]
      : []),
    ...(userRewind.duration.user && hasAudioLibraries && userRewind.audio.top[0]
      ? [createStory('audio', StoryAudio)]
      : []),
    // The music story names the top track, so the top artists show even when
    // there's only one
    ...(userRewind.audio.top.length && hasAudioLibraries
      ? [createStory('audio_top', StoryAudioTop)]
      : []),
    ...(userRewind.titleMoments.comfortWatch
      ? [createStory('comfort_watch', StoryComfortWatch)]
      : []),
    ...(userRewind.titleMoments.timeTravel
      ? [createStory('time_travel', StoryTimeTravel)]
      : []),
    ...(userRewind.titleMoments.discoveries || userRewind.titleMoments.gaveUp
      ? [createStory('discoveries', StoryDiscoveries)]
      : []),
    ...(userRewind.moments.binge ? [createStory('binge', StoryBinge)] : []),
    ...(userRewind.moments.biggestDay
      ? [createStory('biggest_day', StoryBiggestDay)]
      : []),
    ...(userRewind.habits.peakDayIndex !== null
      ? [createStory('habits_day', StoryHabitsDay)]
      : []),
    ...(userRewind.habits.peakHour !== null
      ? [createStory('habits_hour', StoryHabitsHour)]
      : []),
    ...(userRewind.genres.match
      ? [createStory('taste_match', StoryTasteMatch)]
      : []),
    ...(userRewind.social.onlyYou
      ? [createStory('only_you', StoryOnlyYou)]
      : []),
    // The other users and the server come after the viewer's own stories
    ...(userRewind.usersTop && userRewind.usersTop.length > 1
      ? [createStory('users_top', StoryUsersTop)]
      : []),
    ...(isSeerrActive && userRewind.requests
      ? [createStory('requests', StoryRequests)]
      : []),
    ...(isSeerrActive && userRewind.social.requestsReach
      ? [createStory('requests_reach', StoryRequestsReach)]
      : []),
    ...(userRewind.social.serverYear
      ? [createStory('server_year', StoryServerYear)]
      : []),
    ...(userRewind.libraries_total_size
      ? [createStory('libraries', StoryLibraries)]
      : []),
    ...(userRewind.firstPlay
      ? [createStory('first_play', StoryFirstPlay)]
      : []),
    ...(userRewind.personality
      ? [createStory('personality', StoryPersonality)]
      : []),
    // Sums up the stories before it, so it comes last
    ...(hasRewindPlays(userRewind)
      ? [createStory('summary', StorySummary)]
      : []),
    createStory('goodbye', StoryGoodbye),
  ]
}
