from django.db import migrations
from django.db.models import F
from kpi.fields import KpiUidField


def copy_id_to_uid(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    Organization.objects.update(uid=F('id'))


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0003_copy_organization_uid_to_id'),
    ]

    operations = [
        # The field must be made nullable prior to removal; otherwise, the
        # removal will be irreversible
        migrations.AlterField(
            model_name='organization',
            name='uid',
            field=KpiUidField(_null=True, uid_prefix='org'),
        ),
        # Do nothing when migrating forwards, but when migrating backwards,
        # repopulate the `uid` field from the `id` values
        migrations.RunPython(migrations.RunPython.noop, copy_id_to_uid),
        migrations.RemoveField(
            model_name='organization',
            name='uid',
        ),
    ]
