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
- `name`
- `owner__username`
- `subscribers_count`


Note: Collections can be displayed first with parameter `collections_first`, e.g.:

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/?collections_first=true&ordering=-name
```
