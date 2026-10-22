import type React from 'react'
import { useEffect, useState } from 'react'

import { Stack, Text } from '@mantine/core'
import { fetchGet, fetchPost, handleApiFail, reportApiFail } from '#/api'
import InjectedHtml from '#/auth/AuthContainer/InjectedHtml'
import { useLogoutAndReload } from '#/auth/useLogout'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { FailResponse } from '#/dataInterface'
import { currentLang, notify } from '#/utils'
import styles from './tosForm.module.scss'

/** A slug for the `sitewide_messages` endpoint */
const TOS_SLUG = 'terms_of_service'
/** Where `<language>` is language code, e.g. "fr" */
const TOS_SLUG_TRANSLATED = `${TOS_SLUG}_<language>`

const TOS_ACCEPT_ENDPOINT = '/me/tos/'
const TOS_MESSAGES_ENDPOINT = '/api/v2/terms-of-service/'

interface SitewideMessage {
  url: string
  slug: string
  /** HTML or Markdown code. For TOS Announcement this will definitely be HTML. */
  body: string
}

type SitewideMessagesResponse = SitewideMessage[]

/**
 * This form displays a TOS announcement message with an accept button that will cause the UI to be
 * unlocked, and a decline button that will log out the user.
 *
 * Required profile details used to be collected here too. They have their own route blocker now
 * (`ProfileDetailsBlocker`), which runs after this one, so this form is about the terms and nothing else.
 */
export default function TOSForm() {
  // After "Accept" button is clicked, this will be true until the call resolves
  const [isFormPending, setIsFormPending] = useState(false)
  const [announcementMessage, setAnnouncementMessage] = useState<string | undefined>()
  const [acceptError, setAcceptError] = useState<string>()

  const logout = useLogoutAndReload()

  // Get TOS message from endpoint
  useEffect(() => {
    const getTOS = async () => {
      try {
        const response = await fetchGet<SitewideMessagesResponse>(TOS_MESSAGES_ENDPOINT)

        // First we try to find and set the translated TOS message, if not present
        // we go with fallback. Otherwise we will display an error.
        const translatedSlug = TOS_SLUG_TRANSLATED.replace('<language>', currentLang())
        const translatedMessage = response.find((item) => item.slug === translatedSlug)
        const fallbackMessage = response.find((item) => item.slug === TOS_SLUG)
        if (translatedMessage) {
          setAnnouncementMessage(translatedMessage.body)
        } else if (fallbackMessage) {
          setAnnouncementMessage(fallbackMessage.body)
        } else {
          setAnnouncementMessage('')
          notify(t('TOS Update Message not found'), 'error')
        }
      } catch (err) {
        const failResult = err as FailResponse
        handleApiFail(failResult)
        setAnnouncementMessage('')
      }
    }
    getTOS()
  }, [])

  /**
   * Accepting TOS is simply POSTing to this endpoint. When it succeeds, we reload the page to display
   * the unblocked UI.
   */
  async function submitForm(evt: React.FormEvent<HTMLFormElement>) {
    evt.preventDefault()
    setIsFormPending(true)
    setAcceptError(undefined)

    try {
      // No toast: the error shows on the card, like the other blocker errors.
      await fetchPost(TOS_ACCEPT_ENDPOINT, {}, { notifyAboutError: false })
      // TODO ideally we could make the profileStore fetch new account data
      // or even override the `accepted_tos` flag without fetching. But this
      // requires the `app.js` file to be reworked in a bit different fashion,
      // so that it could react to `profileStore.accepted_tos` change. For now
      // we do ugly and simple forced reload :)
      window.location.replace('')
    } catch (err) {
      reportApiFail(err as FailResponse)
      setAcceptError(t('Something went wrong. Please try again later.'))
      setIsFormPending(false)
    }
  }

  const errors = [acceptError, logout.error].filter((error) => error !== undefined)

  return (
    <form onSubmit={submitForm}>
      <Stack gap='xl'>
        {announcementMessage ? (
          <InjectedHtml className={styles.message} html={announcementMessage} />
        ) : (
          <LoadingSpinner message={false} />
        )}

        {errors.length > 0 && (
          <Alert type='error' iconName='alert'>
            <Stack gap='xxs'>
              {errors.map((error) => (
                <Text key={error} inherit>
                  {error}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        <Stack gap='xs'>
          {announcementMessage && (
            <ButtonNew type='submit' size='lg' fullWidth loading={isFormPending} disabled={logout.isPending}>
              {t("I agree, let's go")}
            </ButtonNew>
          )}
          {/* Shown even if the terms never load: the frame has no account menu, so this is the only way out */}
          <ButtonNew
            variant='transparent'
            size='lg'
            fullWidth
            loading={logout.isPending}
            disabled={isFormPending}
            onClick={logout.logOut}
          >
            {announcementMessage ? t("I don't agree, log me out") : t('Logout')}
          </ButtonNew>
        </Stack>
      </Stack>
    </form>
  )
}
