from django.db import migrations

from kpi.models.object_permission import ObjectPermission

PERM_FROM_KC_ONLY = 'from_kc_only'


def noop(apps, schema_editor):
    # Irreversible operation
    pass


def remove_kc_only_perm(apps, schema_editor):
    deleting = ObjectPermission.objects.filter(
        permission__codename=PERM_FROM_KC_ONLY
    )
    print(f"Deleting {deleting.count()} ObjectPermission objects")
    deleting.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0018_increase_metadata_data_file_max_length'),
    ]

    operations = [migrations.RunPython(remove_kc_only_perm, noop)]
