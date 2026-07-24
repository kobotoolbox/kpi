## Get total audio duration for a list of attachments

```curl
  curl -X POST https://kf.kobotoolbox.org/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/attachments/audio-duration/
```

> **Payload**
>
>        {
>           "attachment_uids": [
>               "attXXXXXXXXXXXXXXXXX",
>               "attYYYYYYYYYYYYYYYYY"
>           ]
>        }

* Where: `attachment_uids` (required) is a list of attachment UIDs whose audio duration to retrieve. Maximum 200 UIDs per request.


> **Response**
>
>        {
>           "attachments": [
>               { "uid": "attXXXXXXXXXXXXXXXXX", "seconds": 42 },
>               { "uid": "attYYYYYYYYYYYYYYYYY", "seconds": null }
>           ],
>           "total": 42
>        }

* `attachments` - one entry per recognised, accessible UID in the order submitted.
  Unrecognised or inaccessible UIDs are silently omitted.
* `seconds` - integer duration, or `null` when `ffprobe` could not determine the duration (corrupt file, unsupported format, etc.).
* `total` - sum of all non-null `seconds` values.


### Batching and timeouts

`ffprobe` takes approximately 0.5 s per file. With a 120 s nginx timeout, sending more
than ~200 files per request risks a **504 Gateway Timeout**.

* Submit files in small batches from the front-end.
* Retry on 504 - already-processed attachments will be served from the db, so
  subsequent attempts complete faster.
* Requests exceeding 200 UIDs are rejected immediately with **400 Bad Request**.
