# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0015_assetversion'),
    ]

    operations = [
        migrations.AddField(
            model_name='asset',
            name='settings',
            field=models.JSONField(default=dict),
        ),
    ]
