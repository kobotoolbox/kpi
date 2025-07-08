## Get a specific submission
It is also possible to specify the format.

`id` can be the primary key of the submission or its `uuid`.
Please note that using the `uuid` may match **several** submissions, only
the first match will be returned.

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{uid}/data/{id}.xml
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{uid}/data/{id}.json
```

or

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{uid}/data/{id}/?format=xml
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{uid}/data/{id}/?format=json
```


### ⚠️ Note: DRF-Spectacular Limitation

Due to limitations in **DRF-Spectacular**, the `ACCEPT` headers do not sync properly with the request. As a result, all responses will default to `application/json`, regardless of the specified format.

This means that while alternative formats (like XML) are technically supported and will work via command-line tools (e.g., `curl`), **they will not work** when trying out the endpoint directly from the documentation page.

We’ve still included the header to show supported formats, but keep in mind:
**Only `application/json` will be used in the docs UI.**
