## Update a bulk processing job

Cancels a single bulk processing job for an asset. This endpoint currently only
supports cancellation.

Request body:

```json
{
  "status": "cancelled"
}
```

Cancellation is idempotent. Cancelling an already-cancelled job returns the
current cancelled job. Completed jobs cannot be cancelled.

When a job is cancelled, pending and in-progress child items are marked
`cancelled`; terminal child items are not modified. The response is the updated
job, including `cancelled_by`.
