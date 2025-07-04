## List of submissions for a specific asset

By default, JSON format is used, but XML and GeoJSON are also available:

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/{uid}/data/
```

### Pagination
Two parameters can be used to control pagination.

* `start`: Index (zero-based) from which the results start
* `limit`: Number of results per page <span class='label label-warning'>Maximum results per page is **30000**</span>

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
