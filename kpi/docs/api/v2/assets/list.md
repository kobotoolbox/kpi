## Get user's assets


Search can be made with `q` parameter.
Search filters can be returned with results by passing `metadata=on` to querystring.


Results can be sorted with `ordering` parameter, e.g.:

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/?ordering=-name
```


Allowed fields are:

- `asset_type`
- `date_modified`
- `date_deployed`
- `date_modified__date`
- `date_deployed__date`
- `name`
- `settings__sector`
- `settings__sector__value`
- `settings__description`
- `owner__username`
- `owner__extra_details__data__name`
- `owner__extra_details__data__organization`
- `owner__email`
- `_deployment_status`
- `subscribers_count`


Note: Collections can be displayed first with parameter `collections_first`, e.g.:

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/?collections_first=true&ordering=-name
```
