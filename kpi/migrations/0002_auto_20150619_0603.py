# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import jsonfield.fields
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('kpi', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AssetDeployment',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('asset_version_id', models.IntegerField()),
                ('xform_pk', models.IntegerField(null=True)),
                ('xform_id_string', models.CharField(max_length=100)),
                ('data', jsonfield.fields.JSONField()),
                ('uid', models.CharField(default=b'', max_length=22)),
                ('asset', models.ForeignKey(to='kpi.Asset')),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.AddField(
            model_name='asset',
            name='summary',
            field=jsonfield.fields.JSONField(default={}, null=True),
            preserve_default=True,
        ),
        migrations.AlterField(
            model_name='asset',
            name='asset_type',
            field=models.CharField(default=b'text', max_length=20, choices=[(b'text', b'text'), (b'question', b'question'), (b'block', b'block'), (b'survey', b'survey'), (b'empty', b'empty')]),
            preserve_default=True,
        ),
        migrations.AlterField(
            model_name='asset',
            name='parent',
            field=models.ForeignKey(related_name='assets', blank=True, to='kpi.Collection', null=True),
            preserve_default=True,
        ),
        migrations.AlterField(
            model_name='asset',
            name='uid',
            field=models.CharField(default=b'', max_length=22, blank=True),
            preserve_default=True,
        ),
    ]
