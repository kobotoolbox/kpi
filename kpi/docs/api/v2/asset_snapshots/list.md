### List all snapshots for every asset of a user

This endpoint can be paginated with `offset` and `limit` parameters, e.g.:

```shell
curl -X GET https://[kpi-url]/api/v2/asset_snapshots/?offset=100&limit=50
```

will return entries 100-149
