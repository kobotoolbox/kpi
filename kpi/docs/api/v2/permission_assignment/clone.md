    **Clone permissions from another asset**

    <span class='label label-danger'>All permissions will erased (except the owner's) before new assignments</span>
    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/assets/<code>{uid}</code>/permission-assignments/clone/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/permission-assignments/clone/

    > _Payload to clone permissions from another asset_
    >
    >        {
    >           "clone_from": "{source_asset_uid}"
    >        }

    ### CURRENT ENDPOINT
