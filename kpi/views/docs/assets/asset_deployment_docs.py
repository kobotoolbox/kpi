assets_deployment_get = """
Retrieves the existing deployment, if any.
<pre class="prettyprint">
<b>GET</b> /api/v2/assets/{uid}/deployment/
</pre>

> Example
>
>       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/deployment/
"""

assets_deployment_update = """
Updates the `active` field of the existing deployment.
<pre class="prettyprint">
<b>PATCH</b> /api/v2/assets/{uid}/deployment/
</pre>

> Example
>
>       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/deployment/

Overwrites the entire deployment, including the form contents, but does not change the deployment's identifier
<pre class="prettyprint">
<b>PUT</b> /api/v2/assets/{uid}/deployment/
</pre>

> Example
>
>       curl -X PUT https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/deployment/
"""

assets_deployment_post = """
Creates a new deployment, but only if a deployment does not exist already.
<pre class="prettyprint">
<b>POST</b> /api/v2/assets/{uid}/deployment/
</pre>

> Example
>
>       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/deployment/
"""
