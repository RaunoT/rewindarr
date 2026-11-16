import { authOptions } from '@/lib/auth'
import getSettings from '@/utils/getSettings'
import { canViewFeature, getViewer } from '@/utils/helpers'
import { Viewport } from 'next'
import { getServerSession } from 'next-auth'
import { notFound } from 'next/navigation'
import { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

// Lets the stories reach under the notch and the home bar on phones
export const viewport: Viewport = {
  viewportFit: 'cover',
}

// Shared by the Rewind page and the player page,
// which each lay out the stories their own way
export default async function RewindLayout({ children }: Props) {
  const settings = getSettings()
  const session = await getServerSession(authOptions)

  if (!canViewFeature(settings, 'rewind', getViewer(session))) {
    return notFound()
  }

  return children
}
