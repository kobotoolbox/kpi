# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import datetime
import jsonfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0013_uid_field'),
    ]

    operations = [
        migrations.CreateModel(
            name='AssetVersion',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(max_length=255, null=True)),
                ('date_modified', models.DateTimeField(default=datetime.datetime(2010, 1, 1, 0, 0))),
                ('_reversion_version_id', models.PositiveIntegerField(null=True)),
                ('version_content', jsonfield.fields.JSONField()),
                ('deployed_content', jsonfield.fields.JSONField()),
                ('is_deployed', models.BooleanField(default=False)),
                ('asset', models.ForeignKey(related_name='asset_versions', to='kpi.Asset')),
            ],
        ),
    ]
