import { PersonalityType } from '@/types/rewindPersonality'
import {
  CalendarDaysIcon,
  CheckBadgeIcon,
  ClockIcon,
  FilmIcon,
  ForwardIcon,
  GlobeAltIcon,
  HeartIcon,
  MoonIcon,
  MusicalNoteIcon,
  SparklesIcon,
  SunIcon,
  TrophyIcon,
  TvIcon,
} from '@heroicons/react/24/outline'
import { ComponentType, SVGProps } from 'react'

// Shown with the personality in its story and on the summary card
export const PERSONALITY_ICONS: Record<
  PersonalityType,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  nightOwl: MoonIcon,
  earlyBird: SunIcon,
  weekendWarrior: CalendarDaysIcon,
  binger: ForwardIcon,
  marathoner: TrophyIcon,
  completionist: CheckBadgeIcon,
  explorer: GlobeAltIcon,
  timeTraveller: ClockIcon,
  loyalist: HeartIcon,
  cinephile: FilmIcon,
  seriesDevotee: TvIcon,
  musicLover: MusicalNoteIcon,
  freeSpirit: SparklesIcon,
}
