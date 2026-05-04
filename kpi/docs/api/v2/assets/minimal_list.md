## Return a minimal listing of assets with their deployment status

Returns a paginated list of assets visible to the current user, including only `uid`, `name`, and `deployment_status` (`draft`, `deployed`, or `archived`).

Use the `q` query parameter to filter by asset type (e.g. `?q=asset_type:survey`).

Responses do not include a `count` field. Use the `next` and `previous` links to paginate through results.
