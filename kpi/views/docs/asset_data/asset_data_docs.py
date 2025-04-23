asset_data_bulk_destroy = """
"""

asset_data_bulk_partial_update = """
<pre class="prettyprint">
<b>PATCH</b> /api/v2/assets/<code>{uid}</code>/data/bulk/
</pre>

> Example
>
>       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/bulk/

> **Payload**
>
>        {
>           "submission_ids": [{integer}],
>           "data": {
>               <field_to_update_1>: <value_1>,
>               <field_to_update_2>: <value_2>,
>               <field_to_update_n>: <value_n>
>           }
>        }

where `<field_to_update_n>` is a string and should be an existing XML field value of the submissions.
If `<field_to_update_n>` is part of a group or nested group, the field must follow the group hierarchy
structure, i.e.:

If the field is within a group called `group_1`, the field name is `question_1` and the new value is `new value`,
the payload should contain an item with the following structure:

<pre class="prettyprint">
"group_1/question_1": "new value"
</pre>

Similarly, if there are `N` nested groups, the structure will be:

<pre class="prettyprint">
"group_1/sub_group_1/.../sub_group_n/question_1": "new value"
</pre>
"""

asset_data_destroy = """
Deletes current submission
<pre class="prettyprint">
<b>DELETE</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/
</pre>


> Example
>
>       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/234/
"""

asset_data_duplicate_post = """
Duplicates the data of a submission
<pre class="prettyprint">
<b>POST</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/duplicate/
</pre>

> Example
>
>       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/234/duplicate/
"""

asset_data_list = """
## List of submissions for a specific asset

<pre class="prettyprint">
<b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/
</pre>

By default, JSON format is used, but XML and GeoJSON are also available:

<pre class="prettyprint">
<b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data.xml
<b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data.geojson
<b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data.json
</pre>

or

<pre class="prettyprint">
<b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/?format=xml
<b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/?format=geojson
<b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/?format=json
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/

## Pagination
Two parameters can be used to control pagination.

* `start`: Index (zero-based) from which the results start
* `limit`: Number of results per page <span class='label label-warning'>Maximum results per page is **30000**</span>

> Example: The first ten results
>
>       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/?start=0&limit=10

## Query submitted data
Provides a list of submitted data for a specific form. Use `query`
parameter to apply form data specific, see
<a href="http://docs.mongodb.org/manual/reference/operator/query/">
http://docs.mongodb.org/manual/reference/operator/query/</a>.

For more details see
<a href="https://github.com/SEL-Columbia/formhub/wiki/Formhub-Access-Points-(API)#api-parameters">API Parameters</a>.
<span class='label label-warning'>API parameter `count` is not implemented</span>


<pre class="prettyprint">
<b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/?query={"field":"value"}</b>
<b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/?query={"field":{"op": "value"}}"</b>
</pre>
> Example
>
>       curl -X GET 'https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/?query={"__version__": "vWvkKzNE8xCtfApJvabfjG"}'
>       curl -X GET 'https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/?query={"_submission_time": {"$gt": "2019-09-01T01:02:03"}}'

## About the GeoJSON format

Requesting the `geojson` format returns a `FeatureCollection` where each
submission is a `Feature`. If your form has multiple geographic questions,
use the `geo_question_name` query parameter to determine which question's
responses populate the `geometry` for each `Feature`; otherwise, the first
geographic question is used.  All question/response pairs are included in
the `properties` of each `Feature`, but _repeating groups are omitted_.

Question types are mapped to GeoJSON geometry types as follows:

* `geopoint` to `Point`;
* `geotrace` to `LineString`;
* `geoshape` to `Polygon`.
"""

asset_data_retrieve = """
* `uid` - is the unique identifier of a specific asset
* `id` - is the unique identifier of a specific submission

**It is not allowed to create submissions with `kpi`'s API as this is handled by `kobocat`'s `/submission` endpoint**

Retrieves a specific submission
<pre class="prettyprint">
<b>GET</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/
</pre>

It is also possible to specify the format.

<sup>*</sup>`id` can be the primary key of the submission or its `uuid`.
Please note that using the `uuid` may match **several** submissions, only
the first match will be returned.

<pre class="prettyprint">
<b>GET</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>.xml
<b>GET</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>.json
</pre>

or

<pre class="prettyprint">
<b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/<code>{id}</code>/?format=xml
<b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/<code>{id}</code>/?format=json
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/234/
"""

asset_data_validation_status_destroy = """
"""

asset_data_validation_status_list = """
Retrieves the validation status of a submission.
<pre class="prettyprint">
<b>GET</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/validation_status/
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/234/validation_status/
"""

asset_data_validation_status_partial_update = """
Update the validation of a submission
<pre class="prettyprint">
<b>PATCH</b> /api/v2/assets/<code>{uid}</code>/data/<code>{id}</code>/validation_status/
</pre>

> Example
>
>       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/234/validation_status/

> **Payload**
>
>        {
>           "validation_status.uid": <validation_status>
>        }

where `<validation_status>` is a string and can be one of these values:

* `validation_status_approved`
* `validation_status_not_approved`
* `validation_status_on_hold`
"""

asset_data_validation_statuses_destroy = """
"""

asset_data_validation_statuses_partial_update = """
<pre class="prettyprint">
<b>PATCH</b> /api/v2/assets/<code>{uid}</code>/data/validation_statuses/
</pre>

> Example
>
>       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/validation_statuses/

> **Payload**
>
>        {
>           "submission_ids": [{integer}],
>           "validation_status.uid": <validation_status>
>        }
"""
