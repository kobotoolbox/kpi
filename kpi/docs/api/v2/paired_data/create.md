    ### Create a connection between two projects

    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{asset_uid}</code>/paired-data/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/

    > **Payload**
    >
    >        {
    >           "source": "https://[kpi]/api/v2/assets/aFDZxidYs5X5oJjm2Tmdf5/",
    >           "filename": "external-data.xml",
    >           "fields": [],
    >        }
    >
    >
    > Response
    >
    >       HTTP 201 Created
    >       {
    >           "source": "https://[kpi]/api/v2/assets/aFDZxidYs5X5oJjm2Tmdf5/",
    >           "fields": [],
    >           "filename": "external-data.xml",
    >           "url": "https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/pdFQheFF4cWbtcinRUqc64q/"
    >       }
    >

    * `fields`: Optional. List of questions whose responses will be retrieved
        from the source data. If missing or empty, all responses will be
        retrieved. Questions must be identified by full group path separated by
        slashes, e.g. `group/subgroup/question_name`.
    * `filename`: Must be unique among all asset files. Only accepts letters, numbers and '-'.
