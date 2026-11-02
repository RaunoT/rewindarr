import {
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline'

export type DecisionKind = 'directPlay' | 'directStream' | 'transcode'

// Green when the file plays as is, blue when only its container changes, and
// Plex orange when the server converts it
export const DECISION_ICONS: Record<
  DecisionKind,
  { Icon: typeof CheckCircleIcon; className: string }
> = {
  directPlay: { Icon: CheckCircleIcon, className: 'text-success' },
  directStream: { Icon: ArrowsRightLeftIcon, className: 'text-sky-400' },
  transcode: { Icon: CpuChipIcon, className: 'text-plex' },
}

// Plex's decisions, grouped by how much work they are for the server
export function getDecisionKind(
  decision?: string | null,
): DecisionKind | undefined {
  switch (decision) {
    case 'direct play':
      return 'directPlay'
    case 'copy':
      return 'directStream'
    case 'transcode':
    // Burning in subtitles is a transcode too
    case 'burn':
      return 'transcode'
  }
}
