## Implement part of the OpenRosa Manifest API

⚠️This endpoint is **only available** from the Kobocat domains (ex: kc.kobotoolbox.org or kc-eu.kobotoolbox.org)⚠️

These endpoints return the URLs of form media files so they can be fetched and displayed as needed during form rendering.
These endpoints will also open the form in **creation** mode.

Creating as an anonymous user:
`/{username}/xformManifest/{id}`

Creating as an authenticated user:
`/xformManifest/{id}`
