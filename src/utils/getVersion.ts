import { Version } from '@/types'
import { isTimeoutError } from './connectionErrors'

type GitHubRelease = {
  tag_name?: string
  draft?: boolean
  prerelease?: boolean
}

type VersionCache = {
  key: string
  version: Version
  expiresAt: number
  pending: Promise<Version> | null
  lastFailedAt: number
}

const GITHUB_TIMEOUT_MS = 10_000
const CACHE_TTL_MS = 10 * 60 * 1000
// Without internet access every page would wait for the timeout, so a failed
// check isn't retried for a while.
const GITHUB_RETRY_AFTER_MS = 15 * 60 * 1000
// Next.js can bundle this file into more than one chunk, and each copy would
// otherwise keep its own version cache.
const globalForVersion = globalThis as unknown as {
  rewindarrVersionCache?: VersionCache
}

function getCache(base: Version): VersionCache {
  if (globalForVersion.rewindarrVersionCache?.key !== base.currentVersion) {
    globalForVersion.rewindarrVersionCache = {
      key: base.currentVersion,
      version: base,
      expiresAt: 0,
      pending: null,
      lastFailedAt: 0,
    }
  }

  return globalForVersion.rewindarrVersionCache
}

function parseVersion(version: string): number[] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-develop\.(\d+))?$/.exec(version)

  if (!match) return null

  const [, major, minor, patch, develop] = match

  // A release comes after all of its develop builds
  return [major, minor, patch, develop ?? Infinity].map(Number)
}

export function compareVersions(current: string, latest: string): boolean {
  const currentParts = parseVersion(current)
  const latestParts = parseVersion(latest)

  // Fallback to string comparison if parsing fails
  if (!currentParts || !latestParts) {
    return latest !== current
  }

  const index = latestParts.findIndex((part, i) => part !== currentParts[i])

  return index !== -1 && latestParts[index] > currentParts[index]
}

function pickDevelopRelease(data: unknown): string | null {
  if (!Array.isArray(data)) {
    return null
  }

  // GitHub doesn't list releases in version order (develop.9 comes
  // before develop.18), so take the highest one.
  const latestRelease = (data as GitHubRelease[])
    .filter(
      (release) =>
        typeof release?.tag_name === 'string' &&
        !release.draft &&
        release.prerelease,
    )
    .reduce<GitHubRelease | undefined>(
      (latest, release) =>
        !latest ||
        compareVersions(latest.tag_name as string, release.tag_name as string)
          ? release
          : latest,
      undefined,
    )

  return latestRelease?.tag_name ?? null
}

function pickStableRelease(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null
  }

  const release = data as GitHubRelease

  if (
    typeof release.tag_name === 'string' &&
    !release.draft &&
    !release.prerelease
  ) {
    return release.tag_name
  }

  return null
}

async function refreshVersion(
  cache: VersionCache,
  base: Version,
  isDevelop: boolean,
): Promise<Version> {
  const url = isDevelop
    ? 'https://api.github.com/repos/RaunoT/rewindarr/releases?per_page=100'
    : 'https://api.github.com/repos/RaunoT/rewindarr/releases/latest'

  try {
    const res = await fetch(url, {
      next: {
        revalidate: 600,
      },
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    })

    if (!res.ok) {
      await res.body?.cancel()
      cache.lastFailedAt = Date.now()
      console.error('[GITHUB] - API request failed', res.status, res.statusText)

      return cache.version
    }

    const data: unknown = await res.json()
    const latestTag = isDevelop
      ? pickDevelopRelease(data)
      : pickStableRelease(data)

    if (latestTag) {
      cache.version = {
        ...base,
        latestVersion: latestTag,
        hasUpdate: compareVersions(base.currentVersion, latestTag),
      }
      cache.expiresAt = Date.now() + CACHE_TTL_MS
    } else if (Array.isArray(data)) {
      cache.expiresAt = Date.now() + CACHE_TTL_MS
    } else {
      cache.lastFailedAt = Date.now()
    }

    return cache.version
  } catch (error) {
    cache.lastFailedAt = Date.now()

    if (isTimeoutError(error)) {
      console.error(
        `[GITHUB] - API request timed out after ${GITHUB_TIMEOUT_MS / 1000}s!`,
      )
    } else {
      console.error('[GITHUB] - Error fetching latest release!', error)
    }

    return cache.version
  }
}

export default async function getVersion({
  wait = true,
}: { wait?: boolean } = {}): Promise<Version> {
  // Read statically so Next.js inlines the build's tag. A container can carry
  // an older image's value in its env, which must not change the version.
  const tag = process.env.NEXT_PUBLIC_VERSION_TAG || ''
  const isSHA = /^[0-9a-f]{40}$/i.test(tag) // Check if tag is a 40-character SHA
  const currentVersion = tag ? (isSHA ? tag : `v${tag}`) : 'local' // Prefix with 'v' if not a SHA
  const isDevelop = currentVersion.includes('develop')
  const channel = tag ? (isDevelop || isSHA ? 'develop' : 'stable') : 'local'
  const base: Version = {
    hasUpdate: false,
    latestVersion: currentVersion,
    currentVersion,
    channel,
  }

  if (currentVersion === 'local' || isSHA) {
    return base
  }

  const cache = getCache(base)
  const now = Date.now()

  if (now < cache.expiresAt) {
    return cache.version
  }

  if (now - cache.lastFailedAt > GITHUB_RETRY_AFTER_MS) {
    cache.pending ??= refreshVersion(cache, base, isDevelop).finally(() => {
      cache.pending = null
    })
  }

  if (!wait) {
    return cache.version
  }

  return cache.pending ? await cache.pending : cache.version
}
