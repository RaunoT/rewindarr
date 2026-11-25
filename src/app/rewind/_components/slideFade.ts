// How far a scrolled story reaches below the bottom of the screen, in whole
// pixels, so a slide scrolled to its end, or one that fits, has none
export function getMoreBelow(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
) {
  return Math.max(0, Math.floor(scrollHeight - scrollTop - clientHeight))
}
