# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hook', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='HookLog',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('uid', models.CharField(unique=True, max_length=36)),
                ('tries', models.IntegerField(default=0)),
                ('status_code', models.IntegerField(default=200)),
                ('message', models.CharField(default=b'', max_length=500)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['date_modified'],
            },
        ),
        migrations.RenameField(
            model_name='hook',
            old_name='destination_url',
            new_name='endpoint',
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
