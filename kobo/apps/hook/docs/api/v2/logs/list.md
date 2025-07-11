## List logs of an external services endpoints accessible to requesting user

Where:
    * `asset_uid` - is the unique identifier of a specific asset
    * `hook_uid` - is the unique identifier of a specific external service
    * `uid` - is the unique identifier of a specific log

Use the `status` query parameter to filter logs by numeric status:
    * `status=0`: hook has failed after exhausting all retries
    * `status=1`: hook is still pending
    * `status=2`: hook has succeeded

Use the `start` and `end` query parameters to filter logs by date range, providing ISO-8601 date strings (e.g. '2022-01-14', '2022-01-21 06:51:04', '2022-01-21T06:51:08.144004+02:00').
Note that `start` is inclusive, while `end` is exclusive.
Time zone is assumed to be UTC. If provided, it needs to be in '+00:00' format ('Z' is not supported). Watch out for url encoding for the '+' character (%2B).
