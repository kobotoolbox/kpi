## Return a minimal listing of assets in an organization

Returns a paginated list of assets owned by the organization, including only `uid`, `name`, and `deployment_status` (`draft`, `deployed`, or `archived`).

Use the `q` query parameter to filter by asset type (e.g. `?q=asset_type:survey`).

Responses do not include a `count` field. Use the `next` and `previous` links to paginate through results.
