import type { Flow } from '#/api/models/flow'
import { FlowId } from '#/api/models/flowId'
import { ACCOUNT_AUTH_ROUTES, AUTH_ROUTES } from '#/router/routerConstants'
import type { AuthStatus } from './authStatus'

// Which screen answers an allauth flow.
//
// Ported from `flow2path` and `pathForFlow` in django-allauth react-spa example (see
// https://codeberg.org/allauth/django-allauth/src/branch/main/examples/react-spa/frontend/src/auth/routing.js), with
// two differences: an unmapped flow returns `null` and the caller stays put rather than throwing, and `types` is walked
// in order rather than read at `[0]`, so a factor KPI has no screen for cannot hide one it does.

/** allauth names a type for the flows that have more than one way through them, so we use the two-part key */
function getFlowKey(id: string, type?: string): string {
  return type ? `${id}:${type}` : id
}

/**
 * Flow to screen, by {@link getFlowKey}. The omissions are deliberate: `mfa_authenticate` and `verify_email` are
 * answered inside the card that started them, so no address reaches them with a sign-in underway; `login_by_code`,
 * `verify_phone` and `provider_token` are off in KPI; `provider_redirect` allauth drives itself; and `webauthn` has no
 * screen yet, which is why `mfa_reauthenticate` is keyed per type.
 */
const FLOW_PATHS: Readonly<Record<string, string>> = Object.freeze({
  [FlowId.login]: AUTH_ROUTES.LOGIN,
  [FlowId.signup]: AUTH_ROUTES.SIGNUP,
  [FlowId.provider_signup]: AUTH_ROUTES.PROVIDER_SIGNUP,
  [FlowId.reauthenticate]: ACCOUNT_AUTH_ROUTES.REAUTHENTICATE,
  [getFlowKey(FlowId.mfa_reauthenticate, 'totp')]: ACCOUNT_AUTH_ROUTES.REAUTHENTICATE_TOTP,
  [getFlowKey(FlowId.mfa_reauthenticate, 'recovery_codes')]: ACCOUNT_AUTH_ROUTES.REAUTHENTICATE_RECOVERY_CODES,
})

/** The only flows a reauthentication may send somebody to. */
const REAUTHENTICATION_FLOW_IDS: readonly string[] = [FlowId.reauthenticate, FlowId.mfa_reauthenticate]

/** Uses {@link FLOW_PATHS} to not risk drifting apart */
const REAUTHENTICATION_PATHS: readonly string[] = Object.entries(FLOW_PATHS)
  .filter(([key]) => REAUTHENTICATION_FLOW_IDS.includes(key.split(':')[0]))
  .map(([, path]) => path)

/** A `reauthenticated` event only means something on one of these, and `next` must never point at one */
export function isReauthenticationRoutePath(routePath: string): boolean {
  return REAUTHENTICATION_PATHS.includes(routePath)
}

/** The screen for one flow, or `null` when KPI answers it somewhere other than a route of its own */
export function pathForFlow(flow: Flow): string | null {
  // allauth orders `types` by preference, so the first one with a screen wins
  for (const type of flow.types ?? []) {
    const path = FLOW_PATHS[getFlowKey(flow.id, type)]
    if (path) {
      return path
    }
  }
  return FLOW_PATHS[flow.id] ?? null
}

export function pathForPendingFlow(status: AuthStatus): string | null {
  return status.pendingFlow ? pathForFlow(status.pendingFlow) : null
}

/**
 * Where to send somebody allauth wants credentials from again. It does not always flag a flow on a reauthentication
 * answer, hence the fallback - restricted to the reauthentication flows, since this runs on an account that is already
 * signed in and `login` would be the wrong destination.
 */
export function pathForReauthentication(status: AuthStatus): string | null {
  // A flagged step is the answer whether or not KPI has a screen for it. Offering a different reauthentication screen
  // would have somebody fill in a credential allauth is not asking for, and get refused.
  if (status.pendingFlow && REAUTHENTICATION_FLOW_IDS.includes(status.pendingFlow.id)) {
    return pathForFlow(status.pendingFlow)
  }

  return (
    status.flows
      .filter((flow) => REAUTHENTICATION_FLOW_IDS.includes(flow.id))
      .map(pathForFlow)
      .find((path) => path !== null) ?? null
  )
}
