# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0018_export_task'),
    ]

    operations = [
        migrations.AddField(
            model_name='asset',
            name='report_custom',
            field=models.JSONField(default=dict),
        ),
    ]
