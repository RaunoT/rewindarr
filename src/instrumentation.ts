// Runs once when the server starts, before any request. The statistics
// source's play history is read from then on, so the first pages opened don't
// have to wait for it, and the newsletter's schedule starts.
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  ) {
    return
  }

  const { prepareAuthEnv } = await import('./lib/authEnv')

  prepareAuthEnv()

  try {
    const { startHistoryRead } = await import('./utils/statsSource')

    startHistoryRead()
  } catch (error) {
    // Settings that can't be read are reported by the pages that need them
    console.error('[HISTORY] - Unable to start reading the history!', error)
  }

  // Warm the release version cache in the background so SSR never blocks on GitHub
  void import('./utils/getVersion')
    .then(({ default: getVersion }) => getVersion())
    .catch(() => {})

  const { startEmailSchedule } = await import('./utils/newsletter')

  startEmailSchedule()
}
