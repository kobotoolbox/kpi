import json
import re
from django.contrib.auth.models import User
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatXForm,
    KobocatUser,
)
from kpi.models import Asset
from kpi.db_routers import HitTheRoadDatabaseRouter
route_to_dest = HitTheRoadDatabaseRouter.route_to_destination

all_users_qs = KobocatUser.objects.filter(username__startswith='moveme')

URL_FIND = 'http://10.6.6.1:9001'
URL_REPLACE = 'http://kc.kobo.local:8999'

''' things to fix in _deployment_data
 'identifier': 'http://10.6.6.1:9001/moveme1/forms/a6S3QEvE7d4Wqva3im9eYM',
 'backend_response': {
  'url': 'http://10.6.6.1:9001/api/v1/forms/34',
  'formid': 34,
  }}

  PLUS metadata stuff
'''

with route_to_dest():
    for xform in (
        KobocatXForm.objects.filter(user__in=all_users_qs)
        .only('kpi_asset_uid')
        .iterator()
    ):
        if not xform.kpi_asset_uid:
            print(f'!!! XForm {xform.pk} has no `kpi_asset_uid`; skipped!')
            continue

        dep_dat = (
            Asset.objects.only('_deployment_data')
            .get(uid=xform.kpi_asset_uid)
            ._deployment_data
        )
        old_formid = dep_dat['backend_response']['formid']
        dep_dat['backend_response']['formid'] = xform.pk

        url_trimmed = re.sub(
            r'/[^/]+/?$', '', dep_dat['backend_response']['url']
        )
        dep_dat['backend_response']['url'] = f'{url_trimmed}/{xform.pk}'

        # Could use a smaller hammer, but there could be a bunch of URLs like one
        # for each `metadata`
        dep_dat = json.loads(json.dumps(dep_dat).replace(URL_FIND, URL_REPLACE))

        Asset.objects.filter(uid=xform.kpi_asset_uid).update(
            _deployment_data=dep_dat
        )

        print(
            f"{xform.kpi_asset_uid}: {old_formid} →"
            f" {dep_dat['backend_response']['formid']}"
        )
