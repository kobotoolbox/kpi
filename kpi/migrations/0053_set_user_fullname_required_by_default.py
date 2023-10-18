from constance import config
from django.db import migrations

from kobo.apps.constance_backends.utils import to_python_object
from kpi.utils.json import LazyJSONSerializable


def make_fullname_required_by_default(apps, schema_editor):
    user_metadata_fields = to_python_object(config.USER_METADATA_FIELDS)
    for field in user_metadata_fields:
        if field['name'] == 'name':
            field['required'] = True
            break

    setattr(
        config,
        'USER_METADATA_FIELDS',
        LazyJSONSerializable(user_metadata_fields),
    )


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0052_add_deployment_status_to_asset'),
    ]

    operations = [
        migrations.RunPython(
            make_fullname_required_by_default,
            migrations.RunPython.noop,
        )
    ]
