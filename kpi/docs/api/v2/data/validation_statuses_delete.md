## Bulk delete submissions status

```curl
  curl -X DELETE https://kf.kobotoolbox.org/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/validation_statuses/
```

**Payload**
```json
{
  "payload": {
    "submission_ids": [
        1,
        2
      ],
    "validation_status.uid": "validation_status"
  }
}
```
* Where: "submissions_ids" (required) is a list of submission root id on the data
to delete

The validation status of the submission can be updated. The `validation_status.uid` should be a `string`, and it must be one of the following values:
- `validation_status_approved`
- `validation_status_not_approved`
- `validation_status_on_hold`

**Response**
```json
{
           "detail": "{number_of_submissions} submissions have been updated"
}
```

### !! Due to limitations with DRF-Spectacular current version not fully supporting AOS 3.1, DELETE actions do not support showing a request body OR a response body. This is due to the 'vague' nature of the action which generally does *not* recommend the use of a payload. To still document this endpoint, example for the payload and response will be included but it will not be possible to test this endpoint. The HTTP code and the errors example are, for their part, factual and can be considered when working with the endpoint. !!
