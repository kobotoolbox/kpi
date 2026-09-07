## Retrieve a single sign-on provider

Resolves the `provider_id` used in single sign-on URLs into the provider's display
name, so a client can render the "Log in with …" screen and tell a real provider
from a typo.

Returns display data only, never `client_id`, secrets, or the provider's server URL.

Examples:
```shell
  curl -X GET https://kf.kobotoolbox.org/api/v2/social-apps/nca/
```

> Response 200
```json
{
    "provider_id": "nca",
    "name": "Norwegian Church Aid"
}
```

Requires no authentication, and resolves providers that are hidden from the login
page as well as those shown on it: a hidden provider is not advertised, but is
usable by anyone holding its link, and that link already contains the
`provider_id`. There is intentionally no endpoint listing all providers, the
`social_apps` property of `/api/v2/environment/` lists the public ones only.

An unknown `provider_id` returns `404`.
