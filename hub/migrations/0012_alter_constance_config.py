import json

from constance import config
from django.db import migrations, models


def alter_constance_config(apps, schema_editor):
    # Check that the USER_METADATA_FIELDS has `full_name` set
    user_metadata = json.loads(getattr(config, 'USER_METADATA_FIELDS'))
    name_set = False
    for field in user_metadata:
        if field['name'] == 'full_name':
            name_set = True
    if not name_set:
        user_metadata.append({
            'name': 'full_name',
            'required': False,
        })
        user_metadata_json = json.dumps(user_metadata)
        setattr(config, 'USER_METADATA_FIELDS', user_metadata_json)

    # Check that the PROJECT_METADATA_FIELDS has `description` set
    project_metadata = json.loads(getattr(config, 'PROJECT_METADATA_FIELDS'))
    description_set = False
    for field in project_metadata:
        if field['name'] == 'description':
            description_set = True
    if not description_set:
        project_metadata.append({
            'name': 'description',
            'required': False,
        })
        project_metadata_json = json.dumps(project_metadata)
        setattr(config, 'PROJECT_METADATA_FIELDS', project_metadata_json)


class Migration(migrations.Migration):
    dependencies = [
        ('hub', '0011_extrauserdetail_private_data'),
    ]

    operations = [
        migrations.RunPython(alter_constance_config),
    ]
