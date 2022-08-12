# coding: utf-8
import datetime
import unicodecsv
from celery import shared_task
from collections import Counter

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.storage import get_storage_class
from django.db.models import Sum, Count, F, Value, DateField
from django.db.models.functions import Cast, Concat
from django.utils import timezone

from hub.models import ExtraUserDetail
from kobo.static_lists import COUNTRIES
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatXForm,
    KobocatSubmissionCounter,
    KobocatUser,
    KobocatUserProfile,
    ReadOnlyKobocatDailyXFormSubmissionCounter,
    ReadOnlyKobocatInstance,
    ReadOnlyKobocatMonthlyXFormSubmissionCounter,
)
from kpi.models.asset import Asset

# Make sure this app is listed in `INSTALLED_APPS`; otherwise, Celery will
# complain that the task is unregistered


@shared_task
def generate_country_report(
        output_filename: str, start_date: str, end_date: str):

    def get_row_for_country(code_: str, label_: str):
        row_ = []

        kpi_forms = Asset.objects.filter(
            asset_type=ASSET_TYPE_SURVEY,
            settings__country__value=code,
        )
        instances_count = 0
        for kpi_form in kpi_forms:
            # Use deployments to get the xform the right id_string
            if not kpi_form.has_deployment:
                continue

            xform_id_strings = list(
                Asset.objects.values_list(
                    '_deployment_data__backend_response__id_string', flat=True
                ).filter(
                    _deployment_data__active=True,
                    asset_type=ASSET_TYPE_SURVEY,
                    settings__country__value=code_,
                )
            )
            # Doing it this way because this report is focused on crises in
            # very specific time frames
            instances_count = ReadOnlyKobocatInstance.objects.filter(
                xform__id_string__in=xform_id_strings,
                date_created__range=(start_date, end_date),
            ).count()

        row_.append(label_)
        row_.append(instances_count)

        return row_

    columns = [
        'Country',
        'Count',
    ]

    default_storage = get_storage_class()()
    with default_storage.open(output_filename, 'wb') as output_file:
        writer = unicodecsv.writer(output_file)
        writer.writerow(columns)

        for code, label in COUNTRIES:

            try:
                row = get_row_for_country(code, label)
            except Exception as e:
                row = ['!FAILED!', 'Country: {}'.format(label), repr(e)]
            writer.writerow(row)


@shared_task
def generate_continued_usage_report(output_filename: str, end_date):
    data = []

    if isinstance(end_date, str):
        end_date = datetime.datetime.strptime(end_date, "%Y-%m-%dT%H:%M:%S")

    twelve_months_time = end_date - relativedelta(months=12)
    six_months_time = end_date - relativedelta(months=6)
    three_months_time = end_date - relativedelta(months=3)

    users = User.objects.filter(
        last_login__range=(twelve_months_time, end_date),
    )

    for user in users:
        # twelve months
        assets = user.assets.values('pk', 'date_created').filter(
            date_created__range=(twelve_months_time, end_date),
        )
        submissions_count = (
            ReadOnlyKobocatMonthlyXFormSubmissionCounter.objects.annotate(
                date=Cast(
                    Concat(F('year'), Value('-'), F('month'), Value('-'), 1),
                    DateField(),
                )
            ).filter(
                user_id=user.id,
                date__range=(twelve_months_time, end_date),
            )
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
            user.last_login,
            three_asset_count['asset_count'],
            six_asset_count['asset_count'],
            twelve_asset_count['asset_count'],
            three_submissions_count['submissions_count'],
            six_submissions_count['submissions_count'],
            twelve_submission_count['submissions_count'],
        ])

    headers = [
        'Username',
        'Date Joined',
        'Assets 3m',
        'Assets 6m',
        'Assets 12m',
        'Submissions 3m',
        'Submissions 6m',
        'Submissions 12M',
    ]

    default_storage = get_storage_class()()
    with default_storage.open(output_filename, 'wb') as output:
        writer = unicodecsv.writer(output)
        writer.writerow(headers)
        writer.writerows(data)


@shared_task
def generate_domain_report(output_filename: str, start_date: str, end_date: str):
    emails = User.objects.filter(
        date_joined__range=(start_date, end_date),
    ).values_list('email', flat=True)

    # get a list of the domains
    domains = [email.split('@')[1] if '@' in email else '!!invalid: ' + email
               for email in emails
               ]
    domain_users = Counter(domains)

    # get a count of the assets
    domain_assets = {
        domain:
            Asset.objects.filter(
                owner__email__endswith='@' + domain,
                date_created__range=(start_date, end_date),
            ).count()
            for domain in domain_users.keys()
    }

    # get a count of the submissions
    domain_submissions = {
        domain: ReadOnlyKobocatMonthlyXFormSubmissionCounter.objects.annotate(
            date=Cast(
                Concat(F('year'), Value('-'), F('month'), Value('-'), 1),
                DateField(),
            )
        ).filter(
            user__email__endswith='@' + domain,
            date__range=(start_date, end_date),
        ).aggregate(
            Sum('counter')
        )['counter__sum']
        if domain_assets[domain] else 0
        for domain in domain_users.keys()
    }

    # create the CSV file
    columns = ['Email Domain', 'Users', 'Projects', 'Submissions']

    default_storage = get_storage_class()()
    with default_storage.open(output_filename, 'wb') as output:
        writer = unicodecsv.writer(output)
        writer.writerow(columns)

        for domain, users in domain_users.most_common():
            row = [
                domain,
                users,
                domain_assets[domain],
                domain_submissions[domain]
            ]
            writer.writerow(row)


@shared_task
def generate_forms_count_by_submission_range(output_filename):
    # List of submissions count ranges
    ranges = [
        (0, 0),
        (1, 500),
        (501, 1000),
        (1001, 10000),
        (10001, 50000),
        (50001, None)
    ]

    # store data for csv
    data = []

    today = datetime.datetime.today()
    date = today - relativedelta(months=12)

    for r in ranges:
        forms_count = KobocatXForm.objects.filter(
            date_created__gte=date,
            num_of_submissions__range=r,
        ).values('pk').count()
        data.append([f'{r[0]}-{r[1]}', forms_count])

    headers = ['Range', 'Count']

    # Crate a csv with output filename
    default_storage = get_storage_class()()
    with default_storage.open(output_filename, 'wb') as output:
        writer = unicodecsv.writer(output)
        writer.writerow(headers)
        writer.writerows(data)


@shared_task
def generate_media_storage_report(output_filename):
    attachments = KobocatUserProfile.objects.all().values(
        'user__username',
        'attachment_storage_bytes',
    )
    
    data = []

    for attachment_count in attachments:
        data.append([
            attachment_count['user__username'],
            attachment_count['attachment_storage_bytes'],
        ])

    headers = ['Username', 'Storage Used (Bytes)']

    default_storage = get_storage_class()()
    with default_storage.open(output_filename, 'wb') as output:
        writer = unicodecsv.writer(output)
        writer.writerow(headers)
        writer.writerows(data)


@shared_task
def generate_user_count_by_organization(output_filename: str):
    # get users organizations
    organizations = User.objects.filter(
        extra_details__data__has_key='organization'
    ).values_list(
        'extra_details__data__organization', flat=True
    ).distinct().order_by(
        'extra_details__data__organization'
    )

    data = []

    for organization in organizations:
        count = User.objects.filter(
            extra_details__data__organization=organization
        ).count()
        data.append([organization, count])

    # write data to a csv file
    columns = ['Organization', 'Count']

    default_storage = get_storage_class()()
    with default_storage.open(output_filename, 'wb') as output_file:
        writer = unicodecsv.writer(output_file)
        writer.writerow(columns)
        writer.writerows(data)


@shared_task
def generate_user_report(output_filename: str):

    def format_date(d):
        if hasattr(d, 'strftime'):
            return d.strftime('%F')
        else:
            return d

    def get_row_for_user(u: KobocatUser) -> list:
        row_ = []

        try:
            profile = KobocatUserProfile.objects.get(user=u)
        except KobocatUserProfile.DoesNotExist:
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

        row_.append(KobocatXForm.objects.filter(user=u).count())

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

    default_storage = get_storage_class()()
    with default_storage.open(output_filename, 'wb') as output_file:
        writer = unicodecsv.writer(output_file)
        writer.writerow(columns)
        kc_users = KobocatUser.objects.exclude(
            pk=settings.ANONYMOUS_USER_ID
        ).order_by('pk')
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

    asset_queryset = Asset.objects.values('owner_id', 'owner__extra_details').filter(
        asset_type=ASSET_TYPE_SURVEY,
        date_created__range=(start_date, end_date)
    )
    records = asset_queryset.annotate(
        form_count=Count('pk')
    ).order_by()
    forms_count = {
        record['owner_id']: record['form_count'] for record in records
    }

    # Filter the asset_queryset for active deployments
    asset_queryset = asset_queryset.filter(_deployment_data__active=True)
    records = asset_queryset.annotate(
        deployment_count=Count('pk')
    ).order_by()
    deployment_count = {
        record['owner_id']: record['deployment_count']
        for record in records
    }

    # Get records from SubmissionCounter
    records = (
        ReadOnlyKobocatMonthlyXFormSubmissionCounter.objects.annotate(
            date=Cast(
                Concat(F('year'), Value('-'), F('month'), Value('-'), 1),
                DateField(),
            )
        ).filter().values(
            'user_id',
            'user__username',
            'user__date_joined',
        ).order_by('user__date_joined').annotate(count_sum=Sum('counter'))
    )

    for record in records:
        user_details = ExtraUserDetail.objects.get(
            user__username=record['user__username']
        ).data
        data.append([
            record['user__username'],
            record['user__date_joined'],
            user_details.get('organization', ''),
            user_details.get('country', ''),
            record['count_sum'],
            forms_count.get(record['user_id'], 0),
            deployment_count.get(record['user_id'], 0)
        ])

    columns = [
        'Username',
        'Date Joined',
        'Organization',
        'Country',
        'Submissions Count',
        'Forms Count',
        'Deployments Count'
    ]

    default_storage = get_storage_class()()
    with default_storage.open(output_filename, 'wb') as output:
        writer = unicodecsv.writer(output)
        writer.writerow(columns)
        writer.writerows(data)
