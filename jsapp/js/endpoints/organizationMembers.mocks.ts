import { http, HttpResponse } from 'msw'
import type { MemberListResponse } from '#/api/models/memberListResponse'
import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import type { PaginatedMemberListResponseList } from '#/api/models/paginatedMemberListResponseList'

/**
 * Mirrors `settings.MINIMUM_DEFAULT_SEARCH_CHARACTERS`: the endpoint refuses a shorter bare search term rather than
 * scanning every member for it.
 */
export const MIN_SEARCH_PHRASE_LENGTH = 3

/** Builds one row of the members list. Everything but the identity is boring on purpose. */
export function buildMember(
  username: string,
  fullName: string,
  override?: Partial<MemberListResponse>,
): MemberListResponse {
  return {
    role: MemberRoleEnum.member,
    url: `http://kf.kobo.local/api/v2/organizations/org_id/members/${username}/`,
    user: `http://kf.kobo.local/api/v2/users/${username}/`,
    user__username: username,
    user__email: `${username}@example.com`,
    user__extra_details__name: fullName,
    user__has_mfa_enabled: false,
    user__has_sso_enabled: false,
    date_joined: '2025-01-15T10:00:00Z',
    user__is_active: true,
    invite: null,
    ...override,
  }
}

/**
 * The list the handler serves unless a caller brings its own.
 *
 * "alice" and "alvin" share a two-character prefix on purpose: "al" is a phrase that *would* have matched, yet it sits
 * below `MIN_SEARCH_PHRASE_LENGTH`, which makes the pair the interesting fixture for the minimum-length rule.
 */
export const membersMockList: MemberListResponse[] = [
  buildMember('alice', 'Alice Alvarez'),
  buildMember('alvin', 'Alvin Ndlovu'),
  buildMember('bob', 'Bob Brown'),
]

/**
 * Mock API handler for the organization members endpoint. Use it in Storybook stories in `parameters.msw.handlers[]`.
 *
 * Hand-rolled rather than wrapping Orval's `getApiV2OrganizationsMembersListMockHandler`, which hardcodes `status: 200`
 * and can only override the response body - so it cannot express the two errors below.
 *
 * Reproduces the parts of the `q` contract that callers have to cope with: a bare phrase under
 * `MIN_SEARCH_PHRASE_LENGTH` is an error rather than an empty result.
 *
 * `limit` and `start` are honored, but `next`/`previous` stay null, because the frontend derives pages from `count`.
 */
const organizationMembersMock = (members: MemberListResponse[] = membersMockList) =>
  http.get<never, never, PaginatedMemberListResponseList | { detail: string }>(
    // Byte-identical to the generated handler's pattern, so it intercepts exactly the same requests.
    '*/api/v2/organizations/:uidOrganization/members{/}?',
    ({ request }) => {
      const searchParams = new URL(request.url).searchParams
      const searchPhrase = searchParams.get('q')?.trim() ?? ''

      if (searchPhrase.length > 0 && searchPhrase.length < MIN_SEARCH_PHRASE_LENGTH) {
        return HttpResponse.json({ detail: 'Your query is too short' }, { status: 400 })
      }

      // `word` in the parser grammar is `[^\s():]+`, and quotes open a string literal, so these never reach the
      // database.
      if (/[():'"]/.test(searchPhrase)) {
        return HttpResponse.json({ detail: 'Invalid search query' }, { status: 400 })
      }

      const matches = searchPhrase
        ? members.filter((member) =>
            [member.user__username, member.user__email, member.user__extra_details__name]
              .join(' ')
              .toLowerCase()
              .includes(searchPhrase.toLowerCase()),
          )
        : members

      const start = Number(searchParams.get('start')) || 0
      const limit = Number(searchParams.get('limit')) || matches.length

      return HttpResponse.json({
        count: matches.length,
        next: null,
        previous: null,
        results: matches.slice(start, start + limit),
      })
    },
  )

export default organizationMembersMock
