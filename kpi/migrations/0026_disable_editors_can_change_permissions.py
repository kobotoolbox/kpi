import sys

from django.db import migrations


def forwards_func(apps, schema_editor):
    sys.stderr.write(
        'Disabling `editors_can_change_permissions` on all assets and '
        'collections...'
    )
    sys.stderr.flush()

    Asset = apps.get_model('kpi', 'Asset')  # noqa
    Collection = apps.get_model('kpi', 'Collection')  # noqa
    Asset.objects.update(editors_can_change_permissions=False)
    Collection.objects.update(editors_can_change_permissions=False)


def reverse_func(apps, schema_editor):
    sys.stderr.write(
        'ENABLING `editors_can_change_permissions` on all assets and '
        'collections...'
    )
    sys.stderr.flush()

    Asset = apps.get_model('kpi', 'Asset')  # noqa
    Collection = apps.get_model('kpi', 'Collection')  # noqa
    Asset.objects.update(editors_can_change_permissions=True)
    Collection.objects.update(editors_can_change_permissions=True)


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0025_assign_delete_submissions_permissions'),
    ]

    operations = [
        migrations.RunPython(forwards_func, reverse_func),
    ]
