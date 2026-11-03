'use client'

import Image from 'next/image'
import { useState } from 'react'

type Props = {
  // Tried in turn, like the poster's
  srcs: (string | null | undefined)[]
}

// The poster, blurred into a glow at the top of the tile, so each tile takes
// the colours of what's in it. Inside a glass sheet, whose backdrop filter
// keeps it behind the content.
export default function TileGlow({ srcs }: Props) {
  const [failedSrcs, setFailedSrcs] = useState<string[]>([])
  const src = srcs.find(
    (source): source is string => !!source && !failedSrcs.includes(source),
  )

  if (!src) {
    return null
  }

  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl mask-b-from-0% mask-b-to-80%'
    >
      <Image
        fill
        className='scale-150 object-cover opacity-30 blur-3xl saturate-150'
        alt=''
        src={src}
        sizes='3rem'
        onError={() => setFailedSrcs((failed) => [...failed, src])}
      />
    </div>
  )
}
