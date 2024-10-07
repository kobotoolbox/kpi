# coding: utf-8
from __future__ import annotations

import csv
from collections import Counter
from datetime import datetime
from typing import Union

from celery import shared_task
from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.core.files.storage import default_storage
from django.db.models import CharField, Count, DateField, F, IntegerField, Q, Sum, Value
from django.db.models.functions import Cast, Concat

from hub.models import ExtraUserDetail
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import (
    Instance,
    MonthlyXFormSubmissionCounter,
    XForm,
)
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.trackers.models import NLPUsageCounter
from kobo.static_lists import COUNTRIES
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.models.asset import Asset, AssetDeploymentStatus

# Make sure this app is listed in `INSTALLED_APPS`; otherwise, Celery will
# complain that the task is unregistered


@shared_task
def generate_country_report(output_filename: str, start_date: str, end_date: str):

    def get_row_for_country(code_: str, label_: str):
        row_ = []

        xform_ids = Asset.objects.values_list(
            '_deployment_data__backend_response__formid', flat=True
        ).filter(
            settings__country_codes__in_array=[code_],
            _deployment_status=AssetDeploymentStatus.DEPLOYED,
            asset_type=ASSET_TYPE_SURVEY,
        )
        # Doing it this way because this report is focused on crises in
        # very specific time frames
        instances_count = Instance.objects.filter(
            xform_id__in=list(xform_ids),
            date_created__date__range=(start_date, end_date),
        ).count()

        row_.append(label_)
        row_.append(instances_count)

        return row_

    columns = [
        'Country',
        'Count',
    ]

    with default_storage.open(output_filename, 'w') as output_file:
        writer = csv.writer(output_file)
        writer.writerow(columns)

        for code, label in COUNTRIES:

            try:
                row = get_row_for_country(code, label)
            except Exception as e:
                row = ['!FAILED!', 'Country: {}'.format(label), repr(e)]
            writer.writerow(row)


@shared_task
def generate_continued_usage_report(output_filename: str, end_date: str):
    data = []

    # We need to work with UTC timezone-aware datetime objects
    end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()

    twelve_months_time = end_date_obj - relativedelta(years=1)
    six_months_time = end_date_obj - relativedelta(months=6)
    three_months_time = end_date_obj - relativedelta(months=3)

    users = User.objects.filter(
        last_login__date__range=(twelve_months_time, end_date),
    )

    for user in users.iterator():
        # twelve months
        assets = user.assets.values('pk', 'date_created').filter(
            date_created__date__range=(twelve_months_time, end_date),
        )
        submissions_count = MonthlyXFormSubmissionCounter.objects.annotate(
            date=Cast(
                Concat(F('year'), Value('-'), F('month'), Value('-'), 1),
                DateField(),
            )
        ).filter(
            user_id=user.id,
            date__range=(twelve_months_time, end_date),
        )
        twelve_asset_count = assets.aggregate(asset_count=Count('pk'))
        twelve_submission_count = submissions_count.aggregate(
            submissions_count=Sum('counter'),
        )

        # six months
        assets = assets.filter(date_created__gte=six_months_time)
        submissions_count = submissions_count.filter(
            date__gte=six_months_time,
        )
        six_asset_count = assets.aggregate(asset_count=Count('pk'))
        six_submissions_count = submissions_count.aggregate(
            submissions_count=Sum('counter'),
        )

        # three months
        assets = assets.filter(date_created__gte=three_months_time)
        submissions_count = submissions_count.filter(
            date__gte=three_months_time,
        )
        three_asset_count = assets.aggregate(asset_count=Count('pk'))
        three_submissions_count = submissions_count.aggregate(
            submissions_count=Sum('counter'),
        )
        data.append([
            user.username,
            user.date_joined,
            user.last_login,
            three_asset_count['asset_count'] or 0,
            six_asset_count['asset_count'] or 0,
            twelve_asset_count['asset_count'] or 0,
            three_submissions_count['submissions_count'] or 0,
            six_submissions_count['submissions_count'] or 0,
            twelve_submission_count['submissions_count'] or 0,
        ])

    headers = [
        'Username',
        'Date Joined',
        'Last Login',
        'Assets 3m',
        'Assets 6m',
        'Assets 12m',
        'Submissions 3m',
        'Submissions 6m',
        'Submissions 12M',
    ]

    with default_storage.open(output_filename, 'w') as output:
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(data)


@shared_task
def generate_domain_report(output_filename: str, start_date: str, end_date: str):

    emails = User.objects.filter(
        date_joined__date__range=(start_date, end_date),
    ).values_list('email', flat=True)

    # get a list of the domains
    domains = [
        email.split('@')[1] if '@' in email else 'Invalid domain ' + email
        for email in emails.iterator()
    ]
    domain_users = Counter(domains)

    # get a count of the assets
    domain_assets = {
        domain: Asset.objects.filter(
            owner__email__endswith='@' + domain,
            date_created__date__range=(start_date, end_date),
        ).count()
        for domain in domain_users.keys()
    }

    # get a count of the submissions
    domain_submissions = {
        domain: (
            MonthlyXFormSubmissionCounter.objects.annotate(
                date=Cast(
                    Concat(F('year'), Value('-'), F('month'), Value('-'), 1),
                    DateField(),
                )
            )
            .filter(
                user__email__endswith='@' + domain,
                date__range=(start_date, end_date),
            )
            .aggregate(Sum('counter'))['counter__sum']
            if domain_assets[domain]
            else 0
        )
        for domain in domain_users.keys()
    }

    # create the CSV file
    columns = ['Email Domain', 'Users', 'Projects', 'Submissions']

    with default_storage.open(output_filename, 'w') as output:
        writer = csv.writer(output)
        writer.writerow(columns)

        for domain, users in domain_users.most_common():
            row = [
                domain,
                users,
                domain_assets[domain],
                domain_submissions[domain]
            ]
            writer.writerow(row)


@shared_task(
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT
)
def generate_forms_count_by_submission_range(output_filename: str):
    # List of submissions count ranges
    ranges = [
        {'label': '0', 'orm_criteria': {'count': 0}},
        {'label': '1 - 500', 'orm_criteria': {'count__range': (1, 500)}},
        {'label': '501 - 1000', 'orm_criteria': {'count__range': (501, 1000)}},
        {'label': '1001 - 10000', 'orm_criteria': {'count__range': (1001, 10000)}},
        {'label': '10001 - 50000', 'orm_criteria': {'count__range': (10001, 50000)}},
        {'label': '50001 and more', 'orm_criteria': {'count__gte': 50001}},
    ]

    # store data for csv
    data = []

    today = datetime.today()
    date_ = today - relativedelta(years=1)
    no_submissions = XForm.objects.filter(
        date_created__date__gte=date_, num_of_submissions=0
    )
    queryset = (
        Instance.objects.values('xform_id')
        .filter(
            date_created__date__gte=date_,
        )
        .annotate(count=Count('xform_id'))
    )

    for r in ranges:
        if r['label'] == '0':
            forms_count = no_submissions.count()
        else:
            forms_count = queryset.filter(**r['orm_criteria']).count()
        data.append([r['label'], forms_count])

    headers = ['Range', 'Count']

    # Crate a csv with output filename
    with default_storage.open(output_filename, 'w') as output:
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(data)


@shared_task
def generate_media_storage_report(output_filename: str):
    attachments = UserProfile.objects.all().values(
        'user__username',
        'attachment_storage_bytes',
    )

    data = []

    for attachment_count in attachments.iterator():
        data.append(
            [
                attachment_count['user__username'],
                attachment_count['attachment_storage_bytes'],
            ]
        )

    headers = ['Username', 'Storage Used (Bytes)']

    with default_storage.open(output_filename, 'w') as output:
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(data)


@shared_task
def generate_user_count_by_organization(output_filename: str):
    # get users organizations
    organizations = (
        User.objects.filter(extra_details__data__has_key='organization')
        .values('extra_details__data__organization')
        .annotate(total=Count('extra_details__data__organization'))
    ).order_by('extra_details__data__organization')

    no_organizations_count = User.objects.exclude(
        Q(pk=settings.ANONYMOUS_USER_ID)
        | Q(extra_details__data__has_key='organization')
    ).count()

    has_no_organizations = False
    data = []
    for o in organizations.iterator():
        if not o['extra_details__data__organization']:
            has_no_organizations = True
            o['extra_details__data__organization'] = 'Unspecified'
            o['total'] += no_organizations_count

        data.append([o['extra_details__data__organization'], o['total']])

    if not has_no_organizations:
        data.insert(0, ['Unspecified', no_organizations_count])

    # write data to a csv file
    columns = ['Organization', 'Count']

    with default_storage.open(output_filename, 'w') as output_file:
        writer = csv.writer(output_file)
        writer.writerow(columns)
        writer.writerows(data)


@shared_task
def generate_user_report(output_filename: str):
    def format_date(d):
        if hasattr(d, 'strftime'):
            return d.strftime('%F')
        else:
            return d

    def get_row_for_user(u: 'kobo_auth.User') -> list:
        row_ = []

        try:
            profile = UserProfile.objects.get(user_id=u.pk)
        except UserProfile.DoesNotExist:
            profile = None

        try:
            extra_user_detail = ExtraUserDetail.objects.get(user_id=u.pk)
        except ExtraUserDetail.DoesNotExist:
            extra_details = None
        else:
            extra_details = extra_user_detail.data

        row_.append(u.username)
        row_.append(u.email)
        row_.append(u.pk)
        row_.append(u.first_name)
        row_.append(u.last_name)

        if extra_details:
            name = extra_details.get('name', '')
        else:
            name = ''
        if name:
            row_.append(name)
        elif profile:
            row_.append(profile.name)
        else:
            row_.append('')

        if extra_details:
            organization = extra_details.get('organization', '')
        else:
            organization = ''
        if organization:
            row_.append(organization)
        elif profile:
            row_.append(profile.organization)
        else:
            row_.append('')

        row_.append(XForm.objects.filter(user=u).count())

        if profile:
            row_.append(profile.num_of_submissions)
        else:
            row_.append(0)

        row_.append(format_date(u.date_joined))
        row_.append(format_date(u.last_login))

        return row_

    CHUNK_SIZE = 1000
    columns = [
        'username',
        'email',
        'pk',
        'first_name',
        'last_name',
        'name',
        'organization',
        'XForm count',
        'num_of_submissions',
        'date_joined',
        'last_login',
    ]

    with default_storage.open(output_filename, 'w') as output_file:
        writer = csv.writer(output_file)
        writer.writerow(columns)
        kc_users = User.objects.exclude(pk=settings.ANONYMOUS_USER_ID).order_by('pk')
        for kc_user in kc_users.iterator(CHUNK_SIZE):
            try:
                row = get_row_for_user(kc_user)
            except Exception as e:
                row = ['!FAILED!', 'User PK: {}'.format(kc_user.pk), repr(e)]
            writer.writerow(row)


@shared_task
def generate_user_statistics_report(
    output_filename: str,
    start_date: str,
    end_date: str
):
    data = []

    asset_queryset = Asset.objects.values(
        'owner_id', 'owner__extra_details'
    ).filter(
        asset_type=ASSET_TYPE_SURVEY, date_created__date__range=(start_date, end_date)
    )
    records = asset_queryset.annotate(form_count=Count('pk')).order_by()
    forms_count = {
        record['owner_id']: record['form_count'] for record in records
    }

    # Filter the asset_queryset for active deployments
    asset_queryset = asset_queryset.filter(
        _deployment_status=AssetDeploymentStatus.DEPLOYED
    )
    records = asset_queryset.annotate(deployment_count=Count('pk')).order_by()
    deployment_count = {
        record['owner_id']: record['deployment_count'] for record in records.iterator()
    }

    # Get records from SubmissionCounter
    records = (
        MonthlyXFormSubmissionCounter.objects.annotate(
            date=Cast(
                Concat(F('year'), Value('-'), F('month'), Value('-'), 1),
                DateField(),
            )
        )
        .filter(date__range=(start_date, end_date))
        .values(
            'user_id',
            'user__username',
            'user__email',
            'user__date_joined',
        ).order_by('user__date_joined').annotate(count_sum=Sum('counter'))
    )

    # get NLP statistics
    nlp_counters = (
        NLPUsageCounter.objects.filter(
            date__range=(start_date, end_date)
        ).values(
            'user_id',
        ).annotate(
            total_google_asr=Sum(
                Cast(F('counters__google_asr_seconds'), IntegerField()),
            ),
            total_google_mt=Sum(
                Cast(F('counters__google_mt_characters'), IntegerField()),
            ),
        )
    )

    def _get_country_value(value: Union[dict, list]) -> str:
        if isinstance(value, dict):
            return value['value']
        elif isinstance(value, list):
            return ', '.join([item['value'] for item in value])

        return value

    for record in records.iterator():
        user_id = record['user_id']
        user_details, created = ExtraUserDetail.objects.get_or_create(
            user_id=user_id
        )
        # Users will only have a counter if they have used NLP services in the
        # specified period so a fallback is needed
        try:
            nlp_totals = nlp_counters.get(user_id=user_id)
        except NLPUsageCounter.DoesNotExist:
            nlp_totals = {}
        data.append([
            record['user__username'],
            user_details.data.get('name', ''),
            record['user__date_joined'],
            record['user__email'],
            user_details.data.get('organization_type', ''),
            user_details.data.get('organization', ''),
            user_details.data.get('organization_website', ''),
            _get_country_value(user_details.data.get('country', '')),
            record['count_sum'],
            forms_count.get(user_id, 0),
            deployment_count.get(user_id, 0),
            nlp_totals.get('total_google_asr', 0),
            nlp_totals.get('total_google_mt', 0),
        ])

    columns = [
        'Username',
        'Name',
        'Date Joined',
        'Email',
        'Organization Type',
        'Organization',
        'Organization Website',
        'Country',
        'Submissions Count',
        'Forms Count',
        'Deployments Count',
        'Google ASR Seconds',
        'Google MT Seconds',
    ]

    with default_storage.open(output_filename, 'w') as output:
        writer = csv.writer(output)
        writer.writerow(columns)
        writer.writerows(data)


@shared_task
def generate_user_details_report(
    output_filename: str,
    start_date: str,
    end_date: str
):
    USER_COLS = [
        'id',
        'username',
        'is_superuser',
        'joined_date',
        'last_login_date',
        'removal_request_date',
        'removed_date',
        'is_active',
        'email',
        'mfa_is_active',
        'asset_count',
    ]
    METADATA_COL = ['metadata']
    EXTRA_DETAILS_COLS = [
        'name',
        'gender',
        'sector',
        'country',
        'city',
        'bio',
        'organization_type',
        'organization',
        'organization_website',
        'primarySector',
        'twitter',
        'linkedin',
        'instagram',
        'newsletter_subscription',
        'metadata',
        'last_ui_language',
    ]

    def flatten_metadata_inplace(metadata: dict):
        for k, v in metadata.items():
            if isinstance(v, list) and v:
                metadata[k] = ', '.join([item['value'] for item in v])
            if isinstance(v, dict) and 'value' in v:
                metadata[k] = v['value']

    def get_row_value(
        row: dict, col: str
    ) -> Union[str, int, float, bool, None]:
        val = row.get(col, '')
        # remove any new lines from text
        if isinstance(val, str):
            val = val.replace('\n', '')
        return val

    values = USER_COLS + METADATA_COL

    data = (
        User.objects.filter(
            date_joined__date__range=(start_date, end_date),
        )
        .exclude(pk=settings.ANONYMOUS_USER_ID)
        .annotate(
            mfa_is_active=F('mfa_methods__is_active'),
            metadata=F('extra_details__data'),
            joined_date=Cast('date_joined', CharField()),
            last_login_date=Cast('last_login', CharField()),
            removal_request_date=Cast(
                'extra_details__date_removal_requested', CharField()
            ),
            removed_date=Cast('extra_details__date_removed', CharField()),
            asset_count=Count('assets'),
        )
        .values(*values)
        .order_by('id')
    )

    with default_storage.open(output_filename, 'w') as f:
        columns = USER_COLS + EXTRA_DETAILS_COLS
        writer = csv.writer(f)
        writer.writerow(columns)
        for row in data.iterator():
            metadata = row.pop('metadata', {}) or {}
            flatten_metadata_inplace(metadata)
            row.update(metadata)
            flat_row = [get_row_value(row, col) for col in columns]
            writer.writerow(flat_row)
