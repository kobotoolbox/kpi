    ### Data sharing

    Control sharing of submission data from this project to other projects

    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/assets/{uid}/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/
    >
    > **Payload**
    >
    >        {
    >           "data_sharing": {
    >              "enabled": true,
    >              "fields": []
    >           }
    >        }
    >

    * `fields`: Optional. List of questions whose responses will be shared. If
        missing or empty, all responses will be shared. Questions must be
        identified by full group path separated by slashes, e.g.
        `group/subgroup/question_name`.

    >
    > Response
    >
    >       HTTP 200 Ok
    >        {
    >           ...
    >           "data_sharing": {
    >              "enabled": true,
    >              "fields": []
    >           }
    >        }
    >
