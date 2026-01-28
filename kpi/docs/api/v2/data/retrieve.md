## Get a specific submission

`{id}` can be:

- The primary key of the submission
- Its `_uuid` <sup>1</sup>
- Its `rootUuid` (without "uuid:" prefix)

<sup>1</sup> Please note that using the `_uuid` may match **several** submissions, only
the first match will be returned.


It is also possible to specify the format.

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{uid_asset}/data/{id}.xml
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{uid_asset}/data/{id}.json
```

or

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{uid_asset}/data/{id}/?format=xml
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{uid_asset}/data/{id}/?format=json
```

### ⚠️ Note: DRF-Spectacular Limitation

Due to limitations in **DRF-Spectacular**, the `ACCEPT` headers do not sync properly with the request. As a result, all responses will default to `application/json`, regardless of the specified format.

This means that while alternative formats (like XML) are technically supported and will work via command-line tools (e.g., `curl`), **they will not work** when trying out the endpoint directly from the documentation page.

We’ve still included the header to show supported formats, but keep in mind:
**Only `application/json` will be used in the docs UI.**
