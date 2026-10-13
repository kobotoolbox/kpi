import { http, HttpResponse } from 'msw'
import type { EmailAddress } from '#/api/models/emailAddress'
import { getMeEmailsListMockHandler } from '#/api/react-query/user-team-organization-usage/msw'

/**
 * Mocks for `/me/emails/` - the account's own email addresses.
 *
 * Only the list has a generated handler worth using: `POST` matters mostly for what it refuses, and `DELETE` is
 * missing from the schema - see `useRemoveUnverifiedEmails`.
 *
 * All three read and write the array they are handed, so a story can watch the list change.
 */

const EMAILS_URL = '*/me/emails{/}?'

export const VERIFIED_EMAIL: EmailAddress = { email: 'zefir@example.com', primary: true, verified: true }
export const PENDING_EMAIL: EmailAddress = { email: 'new@example.com', primary: false, verified: false }

/** Drops unverified addresses */
function keepConfirmed(emails: EmailAddress[], ...added: EmailAddress[]) {
  emails.splice(0, emails.length, ...emails.filter(({ primary, verified }) => primary || verified), ...added)
}

export const userEmailsListMock = (emails: EmailAddress[]) =>
  getMeEmailsListMockHandler(() => {
    return { count: emails.length, next: null, previous: null, results: emails }
  })

/** A new address accepted (mirrors what backend does) */
export const userEmailChangedMock = (emails: EmailAddress[]) =>
  http.post(EMAILS_URL, async ({ request }) => {
    const { email } = (await request.json()) as { email: string }
    const added: EmailAddress = { email, primary: false, verified: false }

    keepConfirmed(emails, added)

    return HttpResponse.json(added, { status: 201 })
  })

export const userEmailsRemovedMock = (emails: EmailAddress[]) =>
  http.delete(EMAILS_URL, () => {
    keepConfirmed(emails)

    return new HttpResponse(null, { status: 204 })
  })

export const userEmailInvalidMock = () =>
  http.post(EMAILS_URL, () => HttpResponse.json({ email: ['Enter a valid email address.'] }, { status: 400 }))
