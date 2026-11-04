'use client'

import usePromiseValue from '@/hooks/usePromiseValue'
import { RewindTotals, RewindUser, UserRewind } from '@/types/rewind'
import { PublicSettings } from '@/types/settings'
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
import { joinStorySections } from './storySections'

type StoryComponent = {
  userRewind: UserRewind
  settings: PublicSettings
}

export type RewindThemes = {
  // The top show's and top movie's theme songs, best first
  showThemes: string[]
  movieThemes: string[]
  // The viewer's most played track, from the media server
  topTrack: string | null
}

// What the stories after the total show, which takes the longest to read
export type RewindData = {
  userRewind: UserRewind
  themes: RewindThemes
}

type Props = {
  user: RewindUser
  settings: PublicSettings
  // The admin's own track, which every story falls back to
  track: string | null
  // Read while the welcome shows, the total first
  totals: Promise<RewindTotals>
  rewind: Promise<RewindData>
}

// Where the top show's and top movie's theme songs play
const SHOW_STORIES = ['shows', 'shows_top', 'shows_actors', 'shows_genres']
const MOVIE_STORIES = [
  'movies',
  'movies_top',
  'movies_directors',
  'movies_actors',
  'movies_genres',
]
const AUDIO_STORIES = ['audio', 'audio_top']

export default function RewindStories({
  user,
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
    component: () => <StoryWelcome userRewind={{ user }} settings={settings} />,
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
  const stories = joinStorySections<Story>(
    [[welcome], [total], rewind ? getStories(rewind, settings, track) : null],
    { id: 'more', type: 'loading', music },
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
  function createStory(id: string, Component: FC<StoryComponent>): Story {
    // The track also stands in for a title without a theme song
    const themes = SHOW_STORIES.includes(id)
      ? music.showThemes
      : MOVIE_STORIES.includes(id)
        ? music.movieThemes
        : AUDIO_STORIES.includes(id) && music.topTrack
          ? [music.topTrack]
          : []
    const sources = [...themes, track]

    return {
      id,
      type: 'component',
      component: () => (
        <Component userRewind={userRewind} settings={settings} />
      ),
      music: sources.filter((url) => url !== null),
      art: getStoryArt(id, userRewind),
    }
  }

  const isSeerrActive = settings.connection.isSeerrActive
  const isLibrariesSizeAndCountActive =
    settings.rewind.isLibrariesSizeAndCountActive
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
    ...(userRewind.libraries_total_size && isLibrariesSizeAndCountActive
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
