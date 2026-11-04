// The top titles are ranked by watch time, so one played only once is just the
// one the user spent the most time on. It's their favourite once they came
// back to it.
export function isFavorite(item: { total_plays: number }): boolean {
  return item.total_plays > 1
}
