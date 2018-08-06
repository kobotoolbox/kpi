# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import jsonbfield.fields
import kpi.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0021_map-custom-styles'),
    ]

    operations = [
        migrations.CreateModel(
            name='Hook',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('uid', kpi.fields.KpiUidField(uid_prefix=b'h')),
                ('name', models.CharField(max_length=255)),
                ('destination_url', models.CharField(max_length=500)),
                ('active', models.BooleanField(default=True)),
                ('export_type', models.CharField(default=b'json', max_length=10, choices=[(b'xml', b'xml'), (b'json', b'json')])),
                ('success_count', models.IntegerField(default=0)),
                ('failed_count', models.IntegerField(default=0)),
                ('settings', jsonbfield.fields.JSONField(default=dict)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now_add=True)),
                ('asset', models.ForeignKey(related_name='hooks', to='kpi.Asset')),
            ],
            options={
                'ordering': ['name'],
            },
        ),
    ]
