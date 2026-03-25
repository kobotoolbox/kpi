## Implement part of the OpenRosa Form Submission API

⚠️This endpoint is **only available** from the koboCAT domains (ex: kc.kobotoolbox.org or kc-eu.kobotoolbox.org)⚠️

This endpoint is used for adding submissions as an authenticated user.

### XML Submission

Submit an XForm instance as an XML file using `multipart/form-data`.

**Example:**

```shell
curl -X POST https://kc.kobotoolbox.org/submission \
  -u user:password \
  -F xml_submission_file=@/path/to/submission.xml
```

### JSON Submission

Submit an XForm instance as JSON using `application/json`.

The body must include:
- `id`: the form's `id_string` (visible in the form URL or settings)
- `submission`: the form data as a JSON object
- `submission.meta.instanceID`: a unique UUID for this submission (required)

**Example:**

```shell
curl -X POST https://kc.kobotoolbox.org/submission \
  -u user:password \
  -H "Content-Type: application/json" \
  -d '{
    "id": "{id_string}",
    "submission": {
      "question_1": "value_1",
      "meta": {
        "instanceID": "uuid:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    }
  }'
```
