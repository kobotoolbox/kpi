## Set a new email

The new email will be unverified and replace existing unverified, non-primary emails.
New email is not usable until verified.

### Re-authentication

Changing the email address is a sensitive action, so a valid session is not enough
on its own: the user must have authenticated recently. "Recently" means within
`ACCOUNT_REAUTHENTICATION_TIMEOUT` (5 minutes by default), and every method the
account has available must be fresh, the password, plus MFA when it is enabled.

When that is not the case the endpoint responds `403` without touching any email
address:

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

`flows` lists the steps the client must walk the user through before retrying,
in the same shape allauth's headless API uses. Once every listed flow is
completed the original request will succeed.
