## Creates an export task
    > **Payload**
    >
    >        {
    >           "fields_from_all_versions": "true",
    >           "group_sep": "/",
    >           "hierarchy_in_labels": "true",
    >           "lang": "English (en)",
    >           "multiple_select": "both",
    >           "type": "geojson",
    >           "fields": ["field_1", "field_2"],
    >           "flatten": "true"
    >           "xls_types_as_text": "false",
    >           "include_media_url": "false",
    >           "submission_ids": [1, 2, 3, 4],
    >           "query": {
    >              "$and": [
    >                  {"_submission_time": {"$gte": "2021-08-31"}},
    >                  {"_submission_time": {"$lte": "2021-10-13"}}
    >              ]
    >            }
    >          }
    >        }
Where:
* `fields_from_all_versions` (required) is a boolean to specify whether fields from all form versions will be included in the export.
    * `group_sep` (required) is a value used to separate the names in a hierarchy of groups. Valid inputs include:
        * Non-empty value
    * `hierarchy_in_labels` (required) is a boolean to specify whether the group hierarchy will be displayed in labels
    * `lang` (required) is a string that can be set to:
        * `_xml` to have XML values and headers, or
        * Any translation specified in the form such as `English (en)`, etc.
    * `multiple_select` (required) is a value to specify the display of `multiple_select-type` responses. Valid inputs include:
        * `both`,
        * `summary`, or
        * `details`
    * "`type`" (required) specifies the export format. Valid export formats include:
        * `csv`,
        * `geojson`,
        * `spss_labels`, or
        * `xls`
    * `fields` (optional) is an array of column names to be included in the export (including their group hierarchy). Valid inputs include:
        * An array containing any string value that matches the XML column name
        * An empty array which will result in all columns being included
        * If `fields` is not included in the `export_settings`, all columns will be included in the export
    * `flatten` (optional) is a boolean value and only relevant when exporting to "geojson" format.
    * `xls_types_as_text` (optional) is a boolean value that defaults to `false` and only affects `xls` export types.
    * `include_media_url` (optional) is a boolean value that defaults to `false` and only affects `xls` and "csv" export types. This will include an additional column for media-type questions (`question_name_URL`) with the URL link to the hosted file.
    * `submission_ids` (optional) is an array of submission ids that will filter exported submissions to only the specified array of ids. Valid inputs include:
        * An array containing integer values
        * An empty array (no filtering)
    * `query` (optional) is a JSON object containing a Mongo filter query for filtering exported submissions. Valid inputs include:
        * A JSON object containing a valid Mongo query
        * An empty JSON object (no filtering)
