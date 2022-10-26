import csv
import json
import sys
from io import StringIO
from typing import Union

import constance
from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import CharField, Count, F, Q
from django.db.models.functions import Cast

from kpi.models.asset import Asset


regional_views = json.loads(constance.config.REGIONAL_VIEWS)
regional_assignments = json.loads(constance.config.REGIONAL_ASSIGNMENTS)


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


def get_q(countries_for_user, export_type):
    q = Q()

    if '*' in countries_for_user:
        return q

    if export_type == 'p':
        q = Q(settings__country__in=countries_for_user)
        for country in countries_for_user:
            q |= Q(settings__country__contains=[{'value': country}])
    else:
        for country in countries_for_user:
            q |= Q(extra_details__data__country__contains=[{'value': country}])

    return q


def get_data(filtered_queryset, export_type):
    if export_type == 'p':
        vals = ASSET_FIELDS + (SETTINGS,)
        data = (
            filtered_queryset.annotate(
                owner__name=F('owner__extra_details__data__name'),
                owner__organization=F(
                    'owner__extra_details__data__organization'
                ),
                deployment__active=F('_deployment_data__active'),
                deployment__submission_count=F(
                    '_deployment_data__num_of_submissions'
                ),
            )
            .values(*vals)
            .order_by('id')
        )
    else:
        vals = USER_FIELDS + (METADATA,)
        data = (
            filtered_queryset.exclude(pk=settings.ANONYMOUS_USER_ID)
            .annotate(
                mfa_is_active=F('mfa_methods__is_active'),
                metadata=F('extra_details__data'),
                date_joined_str=Cast('date_joined', CharField()),
                last_login_str=Cast('last_login', CharField()),
                asset_count=Count('assets'),
            )
            .values(*vals)
            .order_by('id')
        )

    return data


def get_all_countries_for_user(views_for_user):
    """
    Get all countries from all views assigned to user
    """
    return list(
        set(
            cc
            for c in regional_views
            for cc in c['countries']
            if c['id'] in views_for_user and 'view_asset' in c['permissions']
        )
    )


def get_countries_for_user_and_view(views_for_user, view):
    return [
        cc for c in regional_views for cc in c['countries'] if c['id'] == view
    ]


def get_views_for_user(user):
    return [
        v['view']
        for v in regional_assignments
        if v['username'] == user.username
    ]


def get_columns(export_type):
    if export_type == 'p':
        key = SETTINGS
        columns = ASSET_FIELDS + SETTINGS_FIELDS
    else:
        key = METADATA
        columns = USER_FIELDS + METADATA_FIELDS
    return key, columns


def get_queryset(export_type):
    return Asset.objects.all() if export_type == 'p' else User.objects.all()


def run_regional_export(*args):
    if len(args) < 2:
        raise Exception('Export type and username must be included in --script-args')

    export_type = args[0]
    if export_type not in ['p', 'u']:
        raise Exception('Specify projects (p) or users (u) export in first argument of --script-args')

    username = args[1]
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        raise Exception('User does not exist')

    view = None
    if len(args) == 3:
        view = int(args[2])

    queryset = get_queryset(export_type)

    views_for_user = get_views_for_user(user)
    if not views_for_user:
        raise Exception('User does not have a view assigned to them')

    if view is None:
        countries_for_user = get_all_countries_for_user(views_for_user)
    elif view in views_for_user:
        countries_for_user = get_countries_for_user_and_view(
            views_for_user, view
        )
    else:
        raise Exception(f'User does not have view {view} assigned to them')

    q = get_q(countries_for_user, export_type)
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
