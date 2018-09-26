# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import django.utils.timezone
import jsonbfield.fields
import kpi.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0022_assetfile'),
    ]

    operations = [
        migrations.CreateModel(
            name='Hook',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('uid', kpi.fields.KpiUidField(uid_prefix=b'h')),
                ('name', models.CharField(max_length=255)),
                ('endpoint', models.CharField(max_length=500)),
                ('active', models.BooleanField(default=True)),
                ('export_type', models.CharField(default=b'json', max_length=10, choices=[(b'xml', b'xml'), (b'json', b'json')])),
                ('auth_level', models.CharField(default=b'no_auth', max_length=10, choices=[(b'no_auth', b'no_auth'), (b'basic_auth', b'basic_auth')])),
                ('settings', jsonbfield.fields.JSONField(default=dict)),
                ('date_created', models.DateTimeField(default=django.utils.timezone.now)),
                ('date_modified', models.DateTimeField(default=django.utils.timezone.now)),
                ('asset', models.ForeignKey(related_name='hooks', to='kpi.Asset')),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='HookLog',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('uid', kpi.fields.KpiUidField(uid_prefix=b'hl')),
                ('instance_uuid', models.CharField(default=b'', max_length=36, db_index=True)),
                ('tries', models.PositiveSmallIntegerField(default=0)),
                ('status', models.PositiveSmallIntegerField(default=1)),
                ('status_code', models.IntegerField(default=200)),
                ('message', models.TextField(default=b'')),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now_add=True)),
                ('hook', models.ForeignKey(related_name='logs', to='hook.Hook')),
            ],
            options={
                'ordering': ['-date_created'],
            },
        ),
    ]
