import type React from 'react'
import { useEffect, useState } from 'react'

import { fetchGet, fetchPost, handleApiFail } from '#/api'
import { useLogout } from '#/auth/useLogout'
import Button from '#/components/common/button'
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

  const logout = useLogout()

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

    try {
      await fetchPost(TOS_ACCEPT_ENDPOINT, {})
      // TODO ideally we could make the sessionStore fetch new account data
      // or even override the `accepted_tos` flag without fetching. But this
      // requires the `app.js` file to be reworked in a bit different fashion,
      // so that it could react to `sessionStore.accepted_tos` change. For now
      // we do ugly and simple forced reload :)
      window.location.replace('')
    } catch (err) {
      const failResult = err as FailResponse
      handleApiFail(failResult)
      setIsFormPending(false)
    }
  }

  async function leaveForm() {
    setIsFormPending(true)
    try {
      await logout.mutateAsync()
      window.location.replace('')
    } catch {
      setIsFormPending(false)
    }
  }

  if (!announcementMessage) {
    return <LoadingSpinner message={false} />
  }

  return (
    <form className={styles.root} onSubmit={submitForm}>
      <section
        className={styles.message}
        dangerouslySetInnerHTML={{
          __html: announcementMessage,
        }}
      />

      <footer className={styles.footer}>
        <Button
          type='primary'
          size={'l'}
          isSubmit
          isFullWidth
          isPending={isFormPending}
          label={t("I agree, let's go")}
        />

        <Button
          type='secondary'
          size={'l'}
          isFullWidth
          isDisabled={isFormPending}
          label={t("I don't agree, log me out")}
          onClick={leaveForm}
        />
      </footer>
    </form>
  )
}
