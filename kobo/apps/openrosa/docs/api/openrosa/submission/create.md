## Implement part of the OpenRosa Form Submission API

⚠️This endpoint is **only available** from the Kobocat domains (ex: kc.kobotoolbox.org)

This API allows for submitting XForm instances in both XML and JSON formats. Depending on your access level and form settings, you should use one of the following endpoints:

- **[Anonymous Submissions](anonymous.md)**: For forms that allow anonymous data collection
- **[Authenticated Submissions](authenticated.md)**: Standard submissions using standard authentication
- **[Data Collector Submissions](data_collector.md)**: For submissions made via specialized data collector tokens.

### Request Body

#### XML (multipart/form-data)
Submissions should include the XML file as `xml_submission_file`.

**Sample XML Structure:**
```xml
<data id="build_transportation_2011_07_25">
  <transport>
    <item>bicycle</item>
    <quantity>1</quantity>
  </transport>
  <meta>
    <instanceID>uuid:f3d8dc65-91a6-4d0f-9e97-802128083390</instanceID>
  </meta>
</data>
```

#### JSON (application/json)
The JSON body must follow this structure:
```json
{
  "id": "{uid_asset}",
  "submission": {
    "transport": {
      "item": "bicycle",
      "quantity": 1
    },
    "meta": {
      "instanceID": "uuid:f3d8dc65-91a6-4d0f-9e97-802128083390"
    }
  }
}
```

Where `{uid_asset}` is the project UID and the `submission` key contains the submission data.
