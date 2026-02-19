## Implement part of the OpenRosa Form Submission API

⚠️This endpoint is **only available** from the Kobocat domains (ex: kc.kobotoolbox.org or kc-eu.kobotoolbox.org)⚠️

This endpoint is used for adding submissions as a data collector.

### XML Submission

You can submit an XML XForm submission using a `POST` request with `multipart/form-data`.

**Example:**

```shell
curl -X POST -F xml_submission_file=@/path/to/submission.xml \
https://kc.kobotoolbox.org/collector/{token}/submission
```

### JSON Submission

You can also submit a JSON XForm submission.

**Example:**

```shell
curl -X POST -d '{"id": "{uid_asset}", "submission": {submission_json}}' \
http://localhost:8000/collector/{token}/submission -H "Content-Type: application/json"
```

The `{uid_asset}` is the `id_string` of your form, and `{submission_json}` is the submission data in JSON format.

