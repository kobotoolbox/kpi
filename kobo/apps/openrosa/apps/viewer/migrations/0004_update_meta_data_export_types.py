# -*- coding: utf-8 -*-
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('viewer', '0003_auto_20171123_1521'),
    ]

    operations = [
        migrations.AlterField(
            model_name='export',
            name='export_type',
            field=models.CharField(
                default='xls',
                max_length=10,
                choices=[
                    ('xls', 'Excel'),
                    ('csv', 'CSV'),
                    ('zip', 'ZIP'),
                    ('kml', 'kml'),
                ],
            ),
        ),
    ]
