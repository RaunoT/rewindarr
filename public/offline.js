;(() => {
  const MESSAGES = {
    en: { title: 'You are offline', retry: 'Try again' },
    de: { title: 'Du bist offline', retry: 'Erneut versuchen' },
    es: { title: 'Estás sin conexión', retry: 'Intentar de nuevo' },
    et: { title: 'Ühendus puudub', retry: 'Proovi uuesti' },
    fr: { title: 'Vous êtes hors ligne', retry: 'Réessayer' },
    it: { title: 'Sei offline', retry: 'Riprova' },
  }

  function getCookieLocale() {
    for (const part of document.cookie.split('; ')) {
      const separator = part.indexOf('=')

      if (separator > 0 && part.slice(0, separator) === 'locale') {
        try {
          return decodeURIComponent(part.slice(separator + 1))
        } catch {
          return null
        }
      }
    }

    return null
  }

  function findMatch(tags) {
    for (const tag of tags) {
      if (!tag) continue

      const language = tag.toLowerCase().split('-')[0]

      if (Object.hasOwn(MESSAGES, language)) {
        return { lang: tag, messages: MESSAGES[language] }
      }
    }

    return null
  }

  const cookieLocale = getCookieLocale()
  const browserLanguages = navigator.languages?.length
    ? [...navigator.languages]
    : navigator.language
      ? [navigator.language]
      : []
  const match = findMatch([cookieLocale, ...browserLanguages])

  if (!match) return

  const title = document.getElementById('offline-title')
  const retry = document.getElementById('offline-retry')

  document.documentElement.lang = match.lang
  document.title = `${match.messages.title} | Rewindarr`

  if (title) title.textContent = match.messages.title

  if (retry) retry.textContent = match.messages.retry
})()
