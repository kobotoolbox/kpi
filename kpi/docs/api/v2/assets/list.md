    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/

    Search can be made with `q` parameter.
    Search filters can be returned with results by passing `metadata=on` to querystring.
    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/?metadata=on
    >       {
    >           "count": 0
    >           "next": ...
    >           "previous": ...
    >           "results": []
    >           "metadata": {
    >               "languages": [],
    >               "countries": [],
    >               "sectors": [],
    >               "organizations": []
    >           }
    >       }

    Look at [README](https://github.com/kobotoolbox/kpi#searching-assets)
    for more details.

    Results can be sorted with `ordering` parameter.
    Allowed fields are:

    - `asset_type`
    - `date_modified`
    - `name`
    - `owner__username`
    - `subscribers_count`

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/?ordering=-name

    _Note: Collections can be displayed first with parameter `collections_first`_

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/?collections_first=true&ordering=-name
