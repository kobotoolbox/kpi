from celery import shared_task

# Make sure this app is listed in `INSTALLED_APPS`; otherwise, Celery will
# complain that the task is unregistered

@shared_task
def generate_user_report(output_filename):
    import unicodecsv
    from django.core.files.storage import get_storage_class
    from django.contrib.auth.models import User
    from kpi.deployment_backends.kc_access.shadow_models import _models
    from hub.models import ExtraUserDetail, FormBuilderPreference

    def format_date(d):
        if hasattr(d, 'strftime'):
            return d.strftime('%F')
        else:
            return d

    def get_row_for_user(u):
        row = []

        try:
            profile = _models.UserProfile.objects.get(user=u)
        except _models.UserProfile.DoesNotExist:
            profile = None
        try:
            extra_details = u.extra_details.data
        except ExtraUserDetail.DoesNotExist:
            extra_details = None

        row.append(u.username)
        row.append(u.email)
        row.append(u.pk)
        row.append(u.first_name)
        row.append(u.last_name)

        if extra_details:
            name = extra_details.get('name', '')
        else:
            name = ''
        if name:
            row.append(name)
        elif profile:
            row.append(profile.name)
        else:
            row.append('')

        if extra_details:
            organization = extra_details.get('organization', '')
        else:
            organization = ''
        if organization:
            row.append(organization)
        elif profile:
            row.append(profile.organization)
        else:
            row.append('')

        row.append(_models.XForm.objects.filter(user=u).count())

        if profile:
            row.append(profile.num_of_submissions)
        else:
            row.append(0)

        row.append(format_date(u.date_joined))
        row.append(format_date(u.last_login))

        try:
            row.append(u.formbuilderpreference.preferred_builder)
        except FormBuilderPreference.DoesNotExist:
            row.append('')

        return row

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
        'preferred_builder',
    ]

    default_storage = get_storage_class()()
    with default_storage.open(output_filename, 'wb') as output_file:
        writer = unicodecsv.writer(output_file)
        writer.writerow(columns)
        u = None
        while True:
            users = User.objects.all().order_by('pk')
            if u:
                users = users.filter(pk__gt=u.pk)
            users = users[:CHUNK_SIZE]
            if not users.exists():
                break
            for u in users:
                try:
                    row = get_row_for_user(u)
                except Exception as e:
                    row = ['!FAILED!', 'User PK: {}'.format(u.pk), repr(e)]
                writer.writerow(row)
