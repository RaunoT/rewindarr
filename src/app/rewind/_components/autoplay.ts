// What a statement gives the viewer to take in
export type StatementContent = {
  // The characters of the statement itself, which is read word by word
  headline: number
  // The characters of the smaller text in its cards and lists, which is skimmed
  detail: number
  images: number
  charts: number
}

// For the statement to come in and catch the eye
const BASE = 1200
// About 180 words a minute, as the numbers take a moment to sink in
const PER_HEADLINE_CHARACTER = 55
const PER_DETAIL_CHARACTER = 25
const PER_IMAGE = 400
const PER_CHART = 2000
const MIN = 2500
const MAX = 9000
// A countdown keeps the same beat from place to place
const COUNTDOWN_PLACE = 2500
// A beat on a story's last statement, before it all makes way for the next
const STORY_END = 1000

// How long a statement stays up before the stories move on by themselves, in
// milliseconds. A step without a statement of its own (`content` is null)
// shows a countdown's next place.
export function getStatementDuration(
  content: StatementContent | null,
  isStoryEnd: boolean,
): number {
  const duration = content
    ? Math.min(
        Math.max(
          BASE +
            content.headline * PER_HEADLINE_CHARACTER +
            content.detail * PER_DETAIL_CHARACTER +
            content.images * PER_IMAGE +
            content.charts * PER_CHART,
          MIN,
        ),
        MAX,
      )
    : COUNTDOWN_PLACE

  return duration + (isStoryEnd ? STORY_END : 0)
}
