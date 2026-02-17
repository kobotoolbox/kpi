## Implement the OpenRosa Form Submission API

⚠️This endpoint is only available from the Kobocat domains (ex: kc.kobotoolbox.org or kc-eu.kobotoolbox.org)⚠️

This endpoint is used for adding submissions as an anonymous user.

### XML Submission

You can submit an XML XForm submission using a `POST` request with `multipart/form-data`.

**Example:**

```bash
curl -X POST -F xml_submission_file=@/path/to/submission.xml \
https://kc.kobotoolbox.org/api/v1/submissions
```

### JSON Submission

You can also submit a JSON XForm submission.

**Example:**

```bash
curl -X POST -d '{"id": "[form ID]", "submission": [the JSON]}' \
http://localhost:8000/api/v1/submissions -H "Content-Type: application/json"
```

The `[form ID]` is the `id_string` of your form, and `[the JSON]` is the submission data in JSON format.

