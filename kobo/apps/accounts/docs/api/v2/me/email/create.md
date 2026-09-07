## Set a new email

The new email will be unverified and replace existing unverified, non-primary emails.
New email is not usable until verified.

### Re-authentication

Changing the email address is a sensitive action, so a valid session is not enough
on its own: the user must have authenticated recently. "Recently" means within
`ACCOUNT_REAUTHENTICATION_TIMEOUT` (5 minutes by default), and every method the
account has available must be fresh, the password, plus MFA when it is enabled.

This section describes browser sessions. Requests authenticated with a stateless
credential (token, Basic or OAuth2) are re-authenticated differently, in the
request body, as described below.

When re-authentication is needed the endpoint responds `403` without touching any
email address:

```json
{
  "detail": "Re-authentication is required for this action.",
  "code": "reauthentication_required",
  "flows": [
    {"id": "reauthenticate"},
    {"id": "mfa_reauthenticate", "types": ["totp"]}
  ]
}
```

`code` is the field to branch on: `detail` is translated, so it cannot be
matched against reliably.

`flows` lists the steps the client must walk the user through before retrying,
in the same shape allauth's headless API uses — `reauthenticate` for the
password, and `mfa_reauthenticate` in addition when the account has MFA enabled.
Once every listed flow is completed the original request will succeed.

### Re-authenticating without a browser session

Requests authenticated with a stateless credential (token, Basic or OAuth2) have
no session for allauth to record a re-authentication in, so they carry the proof
in the request body instead:

```json
{
  "email": "new@example.com",
  "current_password": "…",
  "mfa_code": "123456"
}
```

`current_password` is required whenever the account has a usable password.
`mfa_code` is required in addition when MFA is enabled, and accepts either a TOTP
code or a recovery code. Both are rejected with a `400` naming the offending
field, and neither is needed for an SSO-only account that has neither.

Note that Basic authentication is refused outright for MFA-enabled accounts, so
in practice the `mfa_code` case applies to token and OAuth2 callers.

This endpoint is rate limited.

### Trying this from the API docs

A live KoboToolbox session takes precedence over the token set in **Authorize**:
`SessionAuthentication` comes first in `DEFAULT_AUTHENTICATION_CLASSES`, so if you
are logged in, that is what authenticates the call, and the token is never read.

* **To exercise the session payload**, first call
  `POST /api/v2/allauth/browser/v1/auth/reauthenticate` with your password, then
  send `{"email": "…"}` here within `ACCOUNT_REAUTHENTICATION_TIMEOUT`. Without
  that first call you will get the `403` above.
* **To exercise the token payloads**, open the docs in a private window so that no
  session cookie is sent, get your token from `/token/`, and authorize with the
  full value including the keyword: `Token <your-token>`, not the bare key.
  Swagger sends the header verbatim, so omitting the keyword returns `401`.
