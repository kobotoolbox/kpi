# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import kpi.fields


class Migration(migrations.Migration):

    dependencies = [
        ('hook', '0001_initial'),
    ]

    operations = [
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
            ],
            options={
                'ordering': ['-date_created'],
            },
        ),
        migrations.RenameField(
            model_name='hook',
            old_name='destination_url',
            new_name='endpoint',
        ),
        migrations.RemoveField(
            model_name='hook',
            name='failed_count',
        ),
        migrations.RemoveField(
            model_name='hook',
            name='success_count',
        ),
        migrations.AddField(
            model_name='hook',
            name='security_level',
            field=models.CharField(default=b'no_auth', max_length=10, choices=[(b'no_auth', b'no_auth'), (b'basic_auth', b'basic_auth')]),
        ),
        migrations.AddField(
            model_name='hooklog',
            name='hook',
            field=models.ForeignKey(related_name='logs', to='hook.Hook'),
        ),
    ]
