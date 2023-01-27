# coding: utf-8
from __future__ import annotations
import csv
from io import StringIO

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Count, F, Max, Min, OuterRef, Q
from django.db.models.query import QuerySet

from kpi.constants import ASSET_TYPE_SURVEY
from kpi.deployment_backends.kc_access.shadow_models import (
    ReadOnlyKobocatInstance,
)
from kpi.models import Asset, AssetVersion
from kpi.utils.project_views import get_region_for_view


ASSET_FIELDS = (
    'id',
    'uid',
    'name',
    'asset_type',
    'date_modified',
    'date_created',
    'date_deployed',
    'owner',
    'owner__username',
    'owner__email',
    'owner__name',
    'owner__organization',
    'deployment__active',
    'form_id',
)
SETTINGS = 'settings'
SETTINGS_FIELDS = (
    'country',
    'sector',
    'description',
)
ASSET_FIELDS_EXTRA = ('submission_count',)

USER_FIELDS = (
    'username',
    'is_superuser',
    'is_staff',
    'date_joined',
    'last_login',
    'is_active',
    'email',
    'mfa_is_active',
    'asset_count',
)
METADATA = 'metadata'
METADATA_FIELDS = (
    'name',
    'gender',
    'sector',
    'country',
    'city',
    'bio',
    'organization',
    'require_auth',
    'primarySector',
    'organization_website',
    'twitter',
    'linkedin',
    'instagram',
    'metadata',
)
CONFIG = {
    'assets': {
        'queryset': Asset.objects.filter(asset_type=ASSET_TYPE_SURVEY),
        'q_term': 'settings__country_codes__in_array',
        'key': SETTINGS,
        'columns': ASSET_FIELDS + ASSET_FIELDS_EXTRA + SETTINGS_FIELDS,
    },
    'users': {
        'queryset': User.objects.all(),
        'q_term': 'extra_details__data__country__in',
        'key': METADATA,
        'columns': USER_FIELDS + METADATA_FIELDS,
    },
}


def flatten_settings_inplace(settings: dict) -> None:
    for k, v in settings.items():
        if isinstance(v, list) and v:
            items = []
            for item in v:
                if isinstance(item, dict) and 'value' in item:
                    items.append(item['value'])
                    continue
                items.append(item)
            settings[k] = ', '.join(items)
        if isinstance(v, dict) and 'value' in v:
            settings[k] = v['value']
        if not v:
            settings[k] = ''


def get_row_value(row: dict, col: str) -> Union[str, int, float, bool, None]:
    val = row.get(col, '')
    # remove any new lines from text
    if isinstance(val, str):
        val = val.replace('\n', '')
    return val


def get_q(countries: list[str], export_type: str) -> QuerySet:
    q_term = CONFIG[export_type]['q_term']

    if '*' in countries:
        return Q()

    return Q(**{q_term: countries})


def get_submission_count(xform_id: int) -> int:
    return (
        ReadOnlyKobocatInstance.objects.values('xform_id')
        .filter(xform_id=xform_id)
        .count()
    )


def get_data(filtered_queryset: QuerySet, export_type: str) -> QuerySet:
    if export_type == 'assets':
        vals = ASSET_FIELDS + (SETTINGS,)
        data = filtered_queryset.annotate(
            owner__name=F('owner__extra_details__data__name'),
            owner__organization=F('owner__extra_details__data__organization'),
            deployment__active=F('_deployment_data__active'),
            form_id=F('_deployment_data__backend_response__formid'),
        )
    else:
        vals = USER_FIELDS + (METADATA,)
        data = filtered_queryset.exclude(
            pk=settings.ANONYMOUS_USER_ID
        ).annotate(
            mfa_is_active=F('mfa_methods__is_active'),
            metadata=F('extra_details__data'),
            asset_count=Count('assets'),
        )

    return data.values(*vals).order_by('id')


def create_project_view_export(
        export_type: str, username: str, uid: str
) -> StringIO:
    config = CONFIG[export_type]
    region_for_view = get_region_for_view(uid)

    q = get_q(region_for_view, export_type)
    filtered_queryset = config['queryset'].filter(q)
    data = get_data(filtered_queryset, export_type)

    buff = StringIO()
    writer = csv.writer(buff)
    writer.writerow(config['columns'])
    for row in data:
        items = row.pop(config['key'], {}) or {}
        flatten_settings_inplace(items)
        row.update(items)
        # submission counts come from kobocat database and therefore need to be
        # appended manually rather than through queries
        if export_type == 'assets':
            row['submission_count'] = get_submission_count(row['form_id'])
        flat_row = [get_row_value(row, col) for col in config['columns']]
        writer.writerow(flat_row)

    buff.seek(0)
    return buff
