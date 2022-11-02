import csv
from io import StringIO
from typing import Union, List, Tuple

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import CharField, Count, F, Q
from django.db.models.functions import Cast
from django.db.models.query import QuerySet

from kpi.models.asset import Asset
from kpi.utils.regional_views import (
    get_regional_assignments,
    get_regional_views,
    get_region_for_view,
    user_has_view_perms,
)


ASSET_FIELDS = (
    'id',
    'uid',
    'name',
    'asset_type',
    'date_modified',
    'date_created',
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
    'id',
    'username',
    'is_superuser',
    'is_staff',
    'date_joined_str',
    'last_login_str',
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


def flatten_settings_inplace(settings: dict):
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


def get_q(countries: List[str], export_type: str) -> QuerySet:
    q = Q()

    if '*' in countries:
        return q

    if export_type == 'p':
        q = Q(settings__country__in=countries)
        for country in countries:
            q |= Q(settings__country__contains=[{'value': country}])
    else:
        for country in countries:
            q |= Q(extra_details__data__country__contains=[{'value': country}])

    return q


def get_data(filtered_queryset: QuerySet, export_type: str) -> QuerySet:
    if export_type == 'p':
        vals = ASSET_FIELDS + (SETTINGS,)
        data = filtered_queryset.annotate(
            owner__name=F('owner__extra_details__data__name'),
            owner__organization=F('owner__extra_details__data__organization'),
            deployment__active=F('_deployment_data__active'),
            deployment__submission_count=F(
                '_deployment_data__num_of_submissions'
            ),
        )
    else:
        vals = USER_FIELDS + (METADATA,)
        data = filtered_queryset.exclude(
            pk=settings.ANONYMOUS_USER_ID
        ).annotate(
            mfa_is_active=F('mfa_methods__is_active'),
            metadata=F('extra_details__data'),
            date_joined_str=Cast('date_joined', CharField()),
            last_login_str=Cast('last_login', CharField()),
            asset_count=Count('assets'),
        )

    return data.values(*vals).order_by('id')


def get_columns(export_type: str) -> Tuple[str, Tuple[str]]:
    if export_type == 'p':
        key = SETTINGS
        columns = ASSET_FIELDS + SETTINGS_FIELDS
    else:
        key = METADATA
        columns = USER_FIELDS + METADATA_FIELDS
    return key, columns


def get_queryset(export_type: str) -> QuerySet:
    return Asset.objects.all() if export_type == 'p' else User.objects.all()


def create_regional_export(
    export_type: str, username: str, view: int
) -> StringIO:
    if export_type not in ['p', 'u']:
        raise Exception('Specify projects (p) or users (u) export')

    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        raise Exception('User does not exist')

    queryset = get_queryset(export_type)
    region_for_view = get_region_for_view(view)

    q = get_q(region_for_view, export_type)
    filtered_queryset = queryset.filter(q)
    data = get_data(filtered_queryset, export_type)
    key, columns = get_columns(export_type)

    buff = StringIO()
    writer = csv.writer(buff)
    writer.writerow(columns)
    for row in data:
        items = row.pop(key, {})
        flatten_settings_inplace(items)
        row.update(items)
        flat_row = [get_row_value(row, col) for col in columns]
        writer.writerow(flat_row)

    buff.seek(0)
    return buff
