## List of export tasks endpoints

Lists the export tasks accessible to requesting user, for anonymous access
nothing is returned.

<sup>*</sup> _Required permissions: `view_submissions` (View submissions)_

Otherwise, the search can be more specific:

**Exports matching `uid`s:**
```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{asset_uid}/exports/?q=uid__in:ehZUwRctkhp9QfJgvEWGg OR uid__in:ehZUwRctkhp9QfJgvDnjud
```
