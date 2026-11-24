## List of submissions for a specific asset

By default, JSON format is used, but XML and GeoJSON are also available:

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{uid}/data/
```

### Pagination
Two parameters can be used to control pagination.

* `start`: Index (zero-based) from which the results start
* `limit`: Number of results per page <span class='label label-warning'>Maximum results per page cannot exceed  **1000**, unless changed by server configuration</span>
* `count` in the response is exact up to the server's limit (`limited_count_max_rows` in `/api/v2/environment/`), `"many"` past it, and `"unknown"` when counting takes too long. Use `next` to page through results.

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{uid}/data/?start=0&limit=10
```

### Query submitted data
Provides a list of submitted data for a specific form. Use `query`
parameter to apply form data specific, see
<a href="http://docs.mongodb.org/manual/reference/operator/query/">http://docs.mongodb.org/manual/reference/operator/query/</a>.

For more details see
<a href="https://github.com/SEL-Columbia/formhub/wiki/Formhub-Access-Points-(API)#api-parameters">API Parameters</a>.

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{uid}/data/?query={"__version__": "vWvkKzNE8xCtfApJvabfjG"}
curl https://kf.kobotoolbox.org/api/v2/assets/{uid}/data/?query={"_submission_time": {"$gt": "2019-09-01T01:02:03"}}
```

### Detect modified submissions
Each submission has a `_date_modified` timestamp, in the same format as
`_submission_time` (UTC, to the second, e.g. `2026-07-16T08:26:30+00:00`).
`_submission_time` is set when the submission is created and never changes.
`_date_modified` starts with the same value and is refreshed every time:

* the submission is edited (one at a time or in bulk);
* its validation status is changed or removed (one at a time or in bulk);
* an attachment is added to it or deleted from it.

Use it in `query` to retrieve only the submissions created or modified since a
previous request, instead of downloading all of them again:

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{uid}/data/?query={"_date_modified": {"$gte": "2026-07-16T08:26:30%2B00:00"}}
```

`_date_modified` tells that a submission has changed. It is not an exact
cursor: several changes can happen within the same second, and a change can
become visible shortly after its timestamp. To keep an external copy of the
data up to date:

1. Download all the submissions once, without `_date_modified` in `query`, and
   keep the highest `_date_modified` received.
2. On each later run, request the submissions whose `_date_modified` is greater
   than **or equal to** (`$gte`) that value minus a few minutes.
3. Insert or replace the submissions received using their `_id`, since some of
   them were already received in the previous run. Keep the highest
   `_date_modified` for the next run.

Please note that:

* Values are compared as text. Pass a value in `query` the way it is returned,
  in UTC, not converted to another time zone. In a URL, its `+` must be encoded
  as `%2B`, otherwise it is read as a space.
* Submissions which have not been modified since `_date_modified` was
  introduced return their `_submission_time` as `_date_modified`, and are not
  matched by a `query` on `_date_modified` until their next modification. This
  is why the first download must not filter on it.
* Deleted submissions are not reported. To detect them, compare the `_id`s of
  the external copy with the ones returned with `fields=["_id"]`.
* Changes to `_supplementalDetails` (e.g. transcripts and translations) do not
  refresh `_date_modified`.

### About the GeoJSON format
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



### ⚠️ Note: DRF-Spectacular Limitation

Due to limitations in **DRF-Spectacular**, the `ACCEPT` headers do not sync properly with the request. As a result, all responses will default to `application/json`, regardless of the specified format.

This means that while alternative formats (like XML) are technically supported and will work via command-line tools (e.g., `curl`), **they will not work** when trying out the endpoint directly from the documentation page.

We’ve still included the header to show supported formats, but keep in mind:
**Only `application/json` will be used in the docs UI.**
