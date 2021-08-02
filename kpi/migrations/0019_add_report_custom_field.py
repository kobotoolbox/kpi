# coding: utf-8
from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0018_export_task'),
    ]

    operations = [
        migrations.AddField(
            model_name='asset',
            name='report_custom',
            field=JSONBField(default=dict),
        ),
    ]
