# coding: utf-8
from __future__ import annotations

import csv
from io import StringIO
from typing import Union

from django.apps import apps
from django.conf import settings
from django.db.models import CharField, Count, F, Q, Value
from django.db.models.functions import Concat
from django.db.models.query import QuerySet

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.models import Asset
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
    '_deployment_status',
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
    'primarySector',
    'organization_website',
    'twitter',
    'linkedin',
    'instagram',
    'metadata',
)
ACCESS_LOGS_EXPORT_FIELDS = (
    'user_url',
    'user_uid',
    'username',
    'auth_type',
    'date_created',
    'source',
    'ip_address',
    'initial_superusername',
    'initial_superuseruid',
    'authorized_application',
    'other_details',
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
    'access_logs_export': {
        'queryset': lambda: apps.get_model('audit_log', 'AccessLog').objects.all(),
        'key': 'metadata',
        'columns': ACCESS_LOGS_EXPORT_FIELDS,
    },
}


def create_data_export(
    export_type: str, username: str, uid: str, get_all_logs: bool = False
) -> StringIO:
    config = CONFIG[export_type]

    # For access logs, modify the queryset based on the user's superuser status
    if export_type == 'access_logs_export':
        queryset = config['queryset']()

        if not get_all_logs:
            queryset = queryset.filter(user__username=username)
    else:
        region_for_view = get_region_for_view(uid)
        q = get_q(region_for_view, export_type)
        queryset = config['queryset'].filter(q)

    data = get_data(queryset, export_type)
    if export_type == 'access_logs_export':
        # Make sure other_details only contains metadata that has not already been
        # accessed
        accessed_metadata_fields = [
            'auth_type',
            'source',
            'ip_address',
            'initial_user_username',
            'initial_user_uid',
            'auth_app_name',
        ]
        for row in data:
            row['other_details'] = filter_remaining_metadata(
                row, accessed_metadata_fields
            )
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


def filter_remaining_metadata(row, accessed_fields):
    metadata = row['other_details']
    if metadata is not None:
        return {
            key: value for key, value in metadata.items() if key not in accessed_fields
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


def get_data(filtered_queryset: QuerySet, export_type: str) -> QuerySet:
    if export_type == 'assets':
        vals = ASSET_FIELDS + (SETTINGS,)
        return (
            filtered_queryset.annotate(
                owner__name=F('owner__extra_details__data__name'),
                owner__organization=F('owner__extra_details__data__organization'),
                form_id=F('_deployment_data__backend_response__formid'),
            )
            .values(*vals)
            .order_by('id')
        )
    elif export_type == 'users':
        vals = USER_FIELDS + (METADATA,)
        return (
            filtered_queryset.exclude(pk=settings.ANONYMOUS_USER_ID)
            .annotate(
                mfa_is_active=F('mfa_methods__is_active'),
                metadata=F('extra_details__data'),
                asset_count=Count('assets'),
            )
            .values(*vals)
            .order_by('id')
        )
    elif export_type == 'access_logs_export':
        user_url = Concat(
            Value(f'{settings.KOBOFORM_URL}/api/v2/users/'),
            F('user__username'),
            output_field=CharField(),
        )

        return filtered_queryset.annotate(
            user_url=user_url,
            username=F('user__username'),
            auth_type=F('metadata__auth_type'),
            source=F('metadata__source'),
            ip_address=F('metadata__ip_address'),
            initial_superusername=F('metadata__initial_user_username'),
            initial_superuseruid=F('metadata__initial_user_uid'),
            authorized_application=F('metadata__authorized_app_name'),
            other_details=F('metadata'),
        ).values(*ACCESS_LOGS_EXPORT_FIELDS)


def get_q(countries: list[str], export_type: str) -> QuerySet:
    q_term = CONFIG[export_type]['q_term']

    if '*' in countries:
        return Q()

    return Q(**{q_term: countries})


def get_row_value(row: dict, col: str) -> Union[str, int, float, bool, None]:
    val = row.get(col, '')
    # remove any new lines from text
    if isinstance(val, str):
        val = val.replace('\n', '')
    return val


def get_submission_count(xform_id: int) -> int:

    result = XForm.objects.values('num_of_submissions').filter(pk=xform_id).first()

    if not result:
        return 0

    return result['num_of_submissions']
