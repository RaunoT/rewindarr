import { getCountdownStart } from './countdown'

// What a story plays from one of its steps on, in order of preference
export type StepMusic = {
  step: number
  music: string[]
}

// The step of the shows, movies and music stories that names the top title,
// so its music waits for it
export const TOP_TITLE_STEP = 3
// The binge story's step that names the show
export const BINGE_SHOW_STEP = 2

// The music of the latest step shown that has its own, or the story's
export function getStepMusic(
  music: string[],
  stepMusic: StepMusic[],
  step: number,
): string[] {
  let latest: StepMusic | null = null

  for (const other of stepMusic) {
    if (other.step <= step && (!latest || other.step > latest.step)) {
      latest = other
    }
  }

  return latest?.music ?? music
}

// A countdown plays each place's music from the step that shows it
export function getCountdownMusic(places: string[][]): StepMusic[] {
  return places.map((_, step) => ({
    step,
    music: places[getCountdownStart(places.length, step)],
  }))
}
