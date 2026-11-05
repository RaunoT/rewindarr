import { domToBlob } from 'modern-screenshot'

// As wide as a phone screen's pixels. The image is 9:16, so it comes out at
// 1080 × 1920.
const IMAGE_WIDTH = 1080
// Long enough for the browser to start the download first
const REVOKE_DELAY = 60 * 1000

// Drawn by the browser from the image's own element. Its pictures come from
// this app's image proxy, so none of them is cross-origin and blocked from the
// canvas.
export function renderImage(node: HTMLElement): Promise<Blob> {
  return domToBlob(node, {
    type: 'image/png',
    scale: IMAGE_WIDTH / node.offsetWidth,
    // The app uses the system's fonts, so there are none to embed
    font: false,
  })
}

export function downloadImage(image: Blob, fileName: string) {
  const url = URL.createObjectURL(image)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY)
}

export function toImageFile(image: Blob, fileName: string): File {
  return new File([image], fileName, { type: 'image/png' })
}

// iPhones and iPads keep a downloaded image in Files, and a Home Screen app
// only opens it, so only their share sheet's Save Image adds it to Photos.
// Only their browsers know the property.
export function savesWithShareSheet(): boolean {
  return CSS.supports('-webkit-touch-callout', 'none')
}

// Only some browsers, mostly on phones, can share a file
export function canShareImages(): boolean {
  return (
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [toImageFile(new Blob(), 'rewind.png')] })
  )
}
