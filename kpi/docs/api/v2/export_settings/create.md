## Create an export setting for an asset

> Required permissions: `manage_asset` (Manage project)

Where:

* "name" (required) is the name of the export setting displayed in the UI
* "export_settings" (required) is a map of defined settings containing the following valid options:
    * "fields" (optional) is an array of column names to be included in the export (including their group hierarchy). Valid inputs include:
        * An array containing any string value that matches the XML column name
        * An empty array which will result in all columns being included
        * If "fields" is not included in the "export_settings", all columns will be included in the export
* "flatten" (optional) is a boolean value and only relevant when exporting to "geojson" format.
* "fields_from_all_versions" (required) is a boolean to specify whether fields from all form versions will be included in the export.
* "group_sep" (required) is a value used to separate the names in a hierarchy of groups. Valid inputs include:
    * Non-empty value
* "hierarchy_in_labels" (required) is a boolean to specify whether the group hierarchy will be displayed in labels
* "multiple_select" (required) is a value to specify the display of multiple-select-type responses. Valid inputs include:
    * "both",
    * "summary", or
    * "details"
* "type" (required) specifies the export format. Valid export formats include:
    * "csv",
    * "geojson",
    * "spss_labels", or
    * "xls"
* "xls_types_as_text" (optional) is a boolean value that defaults to "false" and only affects "xls" export types.
* "include_media_url" (optional) is a boolean value that defaults to "false" and only affects "xls" and "csv" export types.
* "submission_ids" (optional) is an array of submission ids that will filter exported submissions to only the specified array of ids. Valid inputs include:
    * An array containing integer values
    * An empty array (no filtering)
* "query" (optional) is a JSON object containing a Mongo filter query for filtering exported submissions. Valid inputs include:
    * A JSON object containing a valid Mongo query
    * An empty JSON object (no filtering)

**Note that the following behaviour can be expected when specifying a value for the "multiple_select" field:**

* "summary": Includes one column per question, with all selected choices separated by spaces;
* "details": Expands each multiple-select question to one column per choice, with each of those columns having a binary 1 or 0 to indicate whether that choice was chosen;
* "both": Includes the format of "summary" _and_ "details" in the export
