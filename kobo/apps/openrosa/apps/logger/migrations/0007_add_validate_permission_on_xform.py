# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0006_add_validation_status_json_field_in_instance_table'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='xform',
            options={'ordering': ('id_string',), 'verbose_name': 'XForm', 'verbose_name_plural': 'XForms', 'permissions': (('report_xform', 'Can make submissions to the form'), ('move_xform', 'Can move form between projects'), ('transfer_xform', 'Can transfer form ownership.'), ('validate_xform', 'Can validate submissions.'))},
        ),
    ]
