## Retrieve a bulk processing job

Returns detailed information about a single bulk processing job, including its
current status, per-submission status, processing params, creator, cancellation
metadata, timestamps, and integer `progress` from `0` to `100`.

The response shape is identical to the item returned by the bulk job creation
endpoint and to each item in the paginated list response.
