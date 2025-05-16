    Perform bulk actions on assets

    Actions available:

    - `archive`
    - `delete`
    - `unarchive`
    - `undelete` (superusers only)

    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/bulk/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/bulk/

    > **Payload to preform bulk actions on one or more assets**
    >
    >        {
    >           "payload": {
    >               "asset_uids": [{string}, ...],
    >               "action": {string},
    >           }
    >        }

    > **Payload to preform bulk actions on ALL assets for authenticated user**
    >
    >       {
    >           "payload": {
    >               "confirm": true,
    >               "action": {string}
    >           }
    >       }

