# coding: utf-8
from __future__ import annotations
import csv
from io import StringIO

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Count, F, Max, Min, OuterRef, Q
from django.db.models.query import QuerySet

from kpi.models import Asset, AssetVersion
from kpi.utils.project_views import get_region_for_view


ASSET_FIELDS = (
    'id',
    'uid',
    'name',
    'asset_type',
    'date_modified',
    'date_created',
    'date_latest_deployment',
    'date_first_deployment',
    'owner',
    'owner__username',
    'owner__email',
    'owner__name',
    'owner__organization',
    'deployment__active',
    'deployment__submission_count',
)
SETTINGS = 'settings'
SETTINGS_FIELDS = (
    'country',
    'sector',
    'description',
)

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
        'queryset': Asset.objects.all(),
        'q_term': 'settings__country',
        'key': SETTINGS,
        'columns': ASSET_FIELDS + SETTINGS_FIELDS,
    },
    'users': {
        'queryset': User.objects.all(),
        'q_term': 'extra_details__data__country',
        'key': METADATA,
        'columns': USER_FIELDS + METADATA_FIELDS,
    },
}


def flatten_settings_inplace(settings: dict) -> None:
    for k, v in settings.items():
        if isinstance(v, list) and v:
            settings[k] = ', '.join([item['value'] for item in v])
        if isinstance(v, dict) and 'value' in v:
            settings[k] = v['value']


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

    q = Q(**{f'{q_term}_in': countries})
    for country in countries:
        q |= Q(**{f'{q_term}__contains': [{'value': country}]})

    return q


def get_data(filtered_queryset: QuerySet, export_type: str) -> QuerySet:
    if export_type == 'assets':
        vals = ASSET_FIELDS + (SETTINGS,)
        subquery_latest_deployed = (
            AssetVersion.objects.values('asset_id')
            .annotate(last_deployed=Max('date_modified'))
            .filter(asset_id=OuterRef('pk'))
            .values('last_deployed')
        )
        subquery_first_deployed = (
            AssetVersion.objects.values('asset_id')
            .annotate(first_deployed=Min('date_modified'))
            .filter(asset_id=OuterRef('pk'))
            .values('first_deployed')
        )
        data = filtered_queryset.annotate(
            owner__name=F('owner__extra_details__data__name'),
            owner__organization=F('owner__extra_details__data__organization'),
            deployment__active=F('_deployment_data__active'),
            deployment__submission_count=F(
                '_deployment_data__num_of_submissions'
            ),
            date_latest_deployment=subquery_latest_deployed,
            date_first_deployment=subquery_first_deployed,
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
        flat_row = [get_row_value(row, col) for col in config['columns']]
        writer.writerow(flat_row)

    buff.seek(0)
    return buff
