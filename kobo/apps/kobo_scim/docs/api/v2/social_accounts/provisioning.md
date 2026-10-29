## Check social account provisioning status

Polls whether background SCIM user provisioning has completed for an ongoing single sign-on (SSO) login flow.

When a first-time user authenticates via a SCIM-enabled Identity Provider, the browser is redirected to the provisioning wait screen while Keycloak or Okta asynchronously provisions the account in Kobo via SCIM. The client polls this endpoint to detect when the account has been provisioned and complete the login.

### Session Requirement
Requires an active browser session with the pending `socialaccount_sociallogin` state generated during the OIDC callback. If no pending provisioning session exists or it has expired, the endpoint responds with `200 OK` and `expired: true` (never `401 Unauthorized`).

### Timeout Behavior
The pending provisioning state expires after 60 seconds (`SCIM_PROVISIONING_TIMEOUT`). If SCIM provisioning does not arrive within this window, the pending session is cleared and the endpoint returns `expired: true`.

Examples:
```shell
  curl -X GET https://kf.kobotoolbox.org/api/v2/social-accounts/provisioning/ \
       -H "Cookie: sessionid=..."
```

> Response 200 (Waiting for SCIM)
```json
{
    "ready": false,
    "expired": false,
    "redirect_url": null
}
```

> Response 200 (Account Provisioned & Logged In)
```json
{
    "ready": true,
    "expired": false,
    "redirect_url": "/"
}
```

> Response 200 (Timed Out)
```json
{
    "ready": false,
    "expired": true,
    "redirect_url": null
}
```
