## List of paired project endpoints

    ### Retrieve all paired projects

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/paired-data/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/

    > Response
    >
    >       HTTP 200 OK
    >       {
    >           "count": 1,
    >           "next": null,
    >           "previous": null,
    >           "results": [
    >               {
    >                   "source": "https://[kpi]/api/v2/assets/aFDZxidYs5X5oJjm2Tmdf5/",
    >                   "fields": [],
    >                   "filename": "external-data.xml",
    >                   "url": "https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/pdFQheFF4cWbtcinRUqc64q/"
    >               }
    >           ]
    >       }
    >

    This endpoint is paginated and accepts these parameters:

    - `offset`: The initial index from which to return the results
    - `limit`: Number of results to return per page
