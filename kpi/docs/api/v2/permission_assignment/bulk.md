
    **Assign all permissions at once**

    <span class='label label-danger'>All permissions will erased (except the owner's) before new assignments</span>
    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{uid}</code>/permission-assignments/bulk/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/permission-assignments/bulk/

    > _Payload to assign all permissions at once_
    >
    >        [{
    >           "user": "https://[kpi]/api/v2/users/{username}/",
    >           "permission": "https://[kpi]/api/v2/permissions/{codename}/",
    >        },
    >        {
    >           "user": "https://[kpi]/api/v2/users/{username}/",
    >           "permission": "https://[kpi]/api/v2/permissions/{codename}/",
    >        },...]
