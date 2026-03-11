from constance import config
from django.db import migrations, models

from kobo.apps.constance_backends.utils import to_python_object


def alter_constance_config(apps, schema_editor):
    # Check that the USER_METADATA_FIELDS has `full_name` set
    user_metadata = to_python_object(config.USER_METADATA_FIELDS)
    name_set = False
    for field in user_metadata:
        if field['name'] == 'name':
            name_set = True
            break
    if not name_set:
        user_metadata.insert(0, {'name': 'name', 'required': False})
        setattr(config, 'USER_METADATA_FIELDS', user_metadata)

    # Check that the PROJECT_METADATA_FIELDS has `description` set
    project_metadata = to_python_object(config.PROJECT_METADATA_FIELDS)
    description_set = False
    for field in project_metadata:
        if field['name'] == 'description':
            description_set = True
            break
    if not description_set:
        project_metadata.append({'name': 'description', 'required': False})
        setattr(config, 'PROJECT_METADATA_FIELDS', project_metadata)


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('hub', '0012_replace_markup_with_markdownx'),
    ]

    operations = [
        migrations.RunPython(alter_constance_config, noop),
    ]
