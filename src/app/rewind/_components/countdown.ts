// A ranked list in a story's first statement shows its last place with the
// statement, then one place up each step. Returns the index of the highest
// place shown at the story's `step`.
export function getCountdownStart(count: number, step: number): number {
  return Math.max(count - 1 - step, 0)
}
