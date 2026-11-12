// The stories of each section in turn, null for a section still on the way.
// The sections after one still on the way wait for it, so the stories stay in
// order and only ever join at the end, where `pending` stands in for them.
export function joinStorySections<T>(
  sections: (T[] | null)[],
  pending: T,
): T[] {
  const stories: T[] = []

  for (const section of sections) {
    if (!section) {
      return [...stories, pending]
    }

    stories.push(...section)
  }

  return stories
}

// The stories without the ones the admin hid
export function removeHiddenStories<T extends { id: string }>(
  stories: T[],
  hiddenStories: readonly string[],
): T[] {
  return stories.filter((story) => !hiddenStories.includes(story.id))
}
