    ### Update a connection between two projects

    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/assets/<code>{asset_uid}</code>/paired-data/{paired_data_uid}/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/pdFQheFF4cWbtcinRUqc64q/
    >
    > **Payload**
    >
    >        {
    >           "filename": "data-external.xml",
    >           "fields": ['group/question_1']",
    >        }
    >

    _Notes: `source` cannot be changed_

    > Response
    >
    >       HTTP 200 Ok
    >       {
    >           "source": "https://[kpi]/api/v2/assets/aFDZxidYs5X5oJjm2Tmdf5/",
    >           "fields": ['group/question_1'],
    >           "filename": "data-external.xml",
    >           "url": "https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/pdFQheFF4cWbtcinRUqc64q/"
    >       }
    >
