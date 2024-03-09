import datetime
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

usernames = [x.strip() for x in open('htr-usernames.txt').readlines()]
all_users_qs = KobocatUser.objects.filter(username__in=usernames)

URL_FIND_REPLACE = (
    ('https://kc.kobotoolbox.org/', 'https://kobo-kc.nrc.no/'),
    ('https://kc-eu.kobotoolbox.org/', 'https://kobo-kc.nrc.no/'),
    ('https://kc.humanitarianresponse.info', 'https://kobo-kc.nrc.no/'),
    ('http://hhi-kobo-kobocat/', 'http://nrc-kobo-kobocat/'),
    ('http://ocha-kobo-kobocat/', 'http://nrc-kobo-kobocat/'),
)

''' things to fix in _deployment_data
 'identifier': 'http://10.6.6.1:9001/moveme1/forms/a6S3QEvE7d4Wqva3im9eYM',
 'backend_response': {
  'url': 'http://10.6.6.1:9001/api/v1/forms/34',
  'formid': 34,
  }}

  PLUS metadata stuff
'''

log_file_writer = open(f'kpi-hittheroad2-{datetime.datetime.now()}.log', 'w')
def print_and_log(s):
    print(s)
    log_file_writer.write(s + '\n')

with route_to_dest():
    for xform in (
        KobocatXForm.objects.filter(user__in=all_users_qs)
        .only('kpi_asset_uid')
        .iterator()
    ):
        if not xform.kpi_asset_uid:
            print_and_log(
                f'!!! XForm {xform.pk} has no `kpi_asset_uid`; skipped!'
            )
            continue

        any_changes = False

        dep_dat = (
            Asset.objects.only('_deployment_data')
            .get(uid=xform.kpi_asset_uid)
            ._deployment_data
        )
        old_formid = dep_dat['backend_response']['formid']
        dep_dat['backend_response']['formid'] = xform.pk
        if old_formid != xform.pk:
            any_changes = True

        url_trimmed = re.sub(
            r'/[^/]+/?$', '', dep_dat['backend_response']['url']
        )
        dep_dat['backend_response']['url'] = f'{url_trimmed}/{xform.pk}'

        # Could use a smaller hammer, but there could be a bunch of URLs like one
        # for each `metadata`
        dep_dat_str = json.dumps(dep_dat)
        for find, replace in URL_FIND_REPLACE:
            old_dep_dat_str = dep_dat_str
            dep_dat_str = dep_dat_str.replace(find, replace)
            if old_dep_dat_str != dep_dat_str:
                any_changes = True
        dep_dat = json.loads(dep_dat_str)

        if any_changes:
            Asset.objects.filter(uid=xform.kpi_asset_uid).update(
                _deployment_data=dep_dat
            )

            print_and_log(
                f"{xform.kpi_asset_uid}: {old_formid} →"
                f" {dep_dat['backend_response']['formid']}"
            )
