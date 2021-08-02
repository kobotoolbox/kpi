# coding: utf-8
import unicodecsv

from celery import shared_task
from django.conf import settings
from django.core.files.storage import get_storage_class

from hub.models import ExtraUserDetail
from kobo.static_lists import COUNTRIES
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatUser,
    KobocatUserProfile,
    KobocatXForm,
    ReadOnlyKobocatInstance,
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
