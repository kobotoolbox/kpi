import { useMutation } from '@tanstack/react-query'
import { ROOT_URL } from '#/constants'
import { getCsrfToken, notify } from '#/utils'

/** Django's own `set_language` view, wired up by `django.conf.urls.i18n` (see `kpi/urls/__init__.py`). */
const SET_LANGUAGE_URL = `${ROOT_URL}/i18n/setlang/`

async function setUILanguage(languageCode: string) {
  // `set_language` is a plain Django view, not one of our DRF endpoints, so it reads `request.POST`
  const body = new URLSearchParams({ language: languageCode })

  const csrfToken = getCsrfToken()

  const response = await fetch(SET_LANGUAGE_URL, {
    method: 'POST',
    headers: {
      // Asking for JSON to keep this cheap. Without it `set_language` response of redirect would cause a whole HTML
      // page to be fetched for nothing. Now we will get `204 No Content` instead.
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : null),
    },
    body,
  })

  if (!response.ok) {
    const errorMessage =
      t('Could not set language to ##language_code##').replace('##language_code##', languageCode) +
      ` ${response.status} ${response.statusText}`
    notify.error(errorMessage)
    throw new Error(errorMessage)
  }
}

/**
 * Stores the interface language in the `django_language` cookie, server side.
 *
 * Works for anonymous users, which is the whole point: the language lives in a cookie, not on the
 * user account, so the authentication views can offer it before there is anyone to log in. It also
 * survives logging in, because `hub.middleware.LocaleMiddleware` only writes that cookie when it
 * isn't there yet - whatever the visitor picked on the login screen stays in place afterwards.
 *
 * Note: the language dropdown in `#/components/header/accountMenu.tsx` still does this through the
 * legacy jQuery `dataInterface.setLanguage`, and can be migrated onto this hook.
 */
export function useSetUILanguage() {
  return useMutation({ mutationFn: setUILanguage })
}
