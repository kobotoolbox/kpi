# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Re-apply parts of `0015_add_delete_data_permission.py` for upgrade
    of existing installations.
    See `0015_add_delete_data_permission.py` for details
    """

    dependencies = [
        ('logger', '0015_add_delete_data_permission'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='xform',
            options={
                'ordering': ('id_string',),
                'verbose_name': 'XForm',
                'verbose_name_plural': 'XForms',
                'permissions': (
                    ('report_xform', 'Can make submissions to the form'),
                    ('transfer_xform', 'Can transfer form ownership.'),
                    ('validate_xform', 'Can validate submissions.'),
                    ('delete_data_xform', 'Can delete submissions'),
               ),
            },
        ),
        migrations.AlterModelOptions(
            name='note',
            options={'permissions': ()},
        ),
    ]
