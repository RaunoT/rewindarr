import { MediaServerType } from '@/types/settings'

// The media server's mark in its own color, from the logos in src/assets:
// the chevron from Plex's wordmark, and Jellyfin's icon (CC BY-SA 4.0)
export default function MediaServerLogo({ type }: { type: MediaServerType }) {
  if (type === 'jellyfin') {
    return (
      <svg aria-hidden='true' viewBox='28 22 467 468' fill='#00a4dc'>
        <path d='M261.42,201.62c-20.44,0-86.24,119.29-76.2,139.43s142.48,19.92,152.4,0S281.86,201.63,261.42,201.62Z' />
        <path d='M261.42,23.3C199.83,23.3,1.57,382.73,31.8,443.43s429.34,60,459.24,0S323,23.3,261.42,23.3ZM411.9,390.76c-19.59,39.33-281.08,39.77-300.9,0S221.1,115.48,261.45,115.48,431.49,351.42,411.9,390.76Z' />
      </svg>
    )
  }

  return (
    <svg aria-hidden='true' viewBox='104.1 13.5 27.9 40.7' fill='#ebaf00'>
      <path d='m117.9 33.9-13.8-20.4h14.2L132 33.9l-13.7 20.3h-14.2z' />
    </svg>
  )
}
