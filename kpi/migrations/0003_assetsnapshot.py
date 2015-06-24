# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import jsonfield.fields
from django.conf import settings

from ..models.asset import XlsExportable

class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('kpi', '0002_auto_20150619_0603'),
    ]

    operations = [
        migrations.CreateModel(
            name='AssetSnapshot',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('xml', models.TextField()),
                ('source', jsonfield.fields.JSONField(null=True)),
                ('details', jsonfield.fields.JSONField(default={})),
                ('asset_version_id', models.IntegerField(null=True)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('uid', models.CharField(default=b'', max_length=22, blank=True)),
                ('asset', models.ForeignKey(to='kpi.Asset', null=True)),
                ('owner', models.ForeignKey(related_name='asset_snapshots', to=settings.AUTH_USER_MODEL, null=True)),
            ],
            options={
            },
            bases=(models.Model, XlsExportable),
        ),
    ]
