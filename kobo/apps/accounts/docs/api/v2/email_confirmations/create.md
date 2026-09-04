## Request another account confirmation email

Sends a fresh confirmation link to an email address that is registered but not yet
verified. Confirmation links expire (after
`ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS`, one day by default), so this is how a
user who let theirs lapse gets a new one.

Requires no authentication: the caller has just followed a dead confirmation link
and has no session.

Examples:
```shell
  curl -X POST https://kf.kobotoolbox.org/api/v2/email-confirmations/ \
       -H 'Content-Type: application/json' \
       -d '{"email": "someone@example.com"}'
```

> Response 200
```json
{
    "detail": "If that email address needs confirming, a new confirmation email has been sent to it."
}
```

### Which email is sent

An account that has not verified any address yet is still being activated, and
receives the account activation email. An account that already has a verified
address is partway through an email change, and receives the address
verification email instead.

### The response never says whether the address is registered

The same `200` and the same body come back whether the address belongs to an
account, belongs to an account that has already verified it, or belongs to no
account at all. Otherwise the endpoint would let anyone test whether a given
person holds a KoboToolbox account.

Mail goes out only in the first of those cases. An address that is already
verified is left alone, so this cannot be used to send unsolicited mail to a
verified account.

A syntactically invalid address returns `400`. That reveals nothing about who is
registered, and telling the user their address is malformed is more useful than
silently doing nothing.

### Throttling

The endpoint is rate limited per requested email address, and returns `429` once
that limit is reached. Limiting by address rather than by caller means requests
cannot be spread across many source addresses to flood a single inbox.

The limit is set by the `EMAIL_CONFIRMATION_REQUESTS_PER_HOUR` configuration
option, and can be changed by an administrator without a restart.
