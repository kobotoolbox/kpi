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
