// The language's name in itself, as "English (UK)" rather than "British
// English"
export function getLocaleName(code: string): string {
  const name = new Intl.DisplayNames(code, {
    type: 'language',
    languageDisplay: 'standard',
    style: 'short',
  }).of(code)

  return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : code
}
