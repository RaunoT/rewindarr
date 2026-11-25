// A label under a chart's bars, measured in pixels from the plot's left edge:
// where its bar starts, and how wide the label is
export type SpanLabelBox = {
  start: number
  width: number
}

export type SpanLabelFit = {
  // Set against the plot's right edge, as it would run past it from its bar
  isEndAligned: boolean
  // Left out, as it would run into the next one
  isHidden: boolean
}

// Between two labels, so they don't read as one
const MIN_GAP = 4

// Where each label fits: from its bar's start, or against the plot's right
// edge when it would run past it. A label that would run into the next one is
// left out, so the later ones, like each January's, win over the first
// month's, which only starts a part of a year.
export function fitSpanLabels(
  boxes: SpanLabelBox[],
  plotWidth: number,
): SpanLabelFit[] {
  const fits: SpanLabelFit[] = []

  let nextLeft = Infinity

  for (let index = boxes.length - 1; index >= 0; index--) {
    const { start, width } = boxes[index]
    const isEndAligned = start + width > plotWidth
    const left = isEndAligned ? plotWidth - width : start
    const isHidden = left + width + MIN_GAP > nextLeft

    if (!isHidden) {
      nextLeft = left
    }

    fits[index] = { isEndAligned, isHidden }
  }

  return fits
}
