# coding: utf-8
from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import migrations, models
import django.utils.timezone

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
                ('uid', kpi.fields.KpiUidField(uid_prefix='h')),
                ('name', models.CharField(max_length=255)),
                ('endpoint', models.CharField(max_length=500)),
                ('active', models.BooleanField(default=True)),
                ('export_type', models.CharField(default='json', max_length=10, choices=[('xml', 'xml'), ('json', 'json')])),
                ('auth_level', models.CharField(default='no_auth', max_length=10, choices=[('no_auth', 'no_auth'), ('basic_auth', 'basic_auth')])),
                ('settings', JSONBField(default=dict)),
                ('date_created', models.DateTimeField(default=django.utils.timezone.now)),
                ('date_modified', models.DateTimeField(default=django.utils.timezone.now)),
                ('asset', models.ForeignKey(related_name='hooks', to='kpi.Asset', on_delete=models.CASCADE)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='HookLog',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('uid', kpi.fields.KpiUidField(uid_prefix='hl')),
                ('instance_id', models.IntegerField(default=0, db_index=True)),
                ('tries', models.PositiveSmallIntegerField(default=0)),
                ('status', models.PositiveSmallIntegerField(default=1)),
                ('status_code', models.IntegerField(default=None, null=True, blank=True)),
                ('message', models.TextField(default='')),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now_add=True)),
                ('hook', models.ForeignKey(related_name='logs', to='hook.Hook', on_delete=models.CASCADE)),
            ],
            options={
                'ordering': ['-date_created'],
            },
        ),
    ]
