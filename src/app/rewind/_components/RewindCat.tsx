import { Children, ReactNode } from 'react'

type Props = {
  children: ReactNode
  // Shown after the text, on the line of its last character
  icon: ReactNode
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// A highlighted part of a story statement with an icon after it. A line can
// break before an icon, so the icon is held to the last character. Only that
// character, so a word too long for the line can still wrap.
export default function RewindCat({ children, icon }: Props) {
  const nodes = Children.toArray(children)

  // Trailing spaces would let the line break before the icon
  while (typeof nodes.at(-1) === 'string' && !String(nodes.at(-1)).trim()) {
    nodes.pop()
  }

  let tail = nodes.pop()

  if (typeof tail === 'string' || typeof tail === 'number') {
    const text = String(tail).trimEnd()
    const lastCharacter = Array.from(segmenter.segment(text)).at(-1)

    if (lastCharacter) {
      nodes.push(text.slice(0, lastCharacter.index))
      tail = lastCharacter.segment
    }
  }

  return (
    <span className='rewind-cat'>
      {nodes}
      <span className='whitespace-nowrap'>
        {tail}
        {icon}
      </span>
    </span>
  )
}
