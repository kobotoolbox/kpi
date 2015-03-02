# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import jsonfield.fields
from django.conf import settings
import shortuuidfield.fields


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Collection',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(max_length=30)),
                ('uid', shortuuidfield.fields.ShortUUIDField(max_length=22, editable=False, blank=True)),
                ('owner', models.ForeignKey(related_name='collections', to=settings.AUTH_USER_MODEL)),
                ('parent', models.ForeignKey(related_name='collections', to='kpi.Collection', null=True)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='SurveyAsset',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('title', models.CharField(default=b'', max_length=100, blank=True)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('content', jsonfield.fields.JSONField(null=True)),
                ('additional_sheets', jsonfield.fields.JSONField(null=True)),
                ('settings', jsonfield.fields.JSONField(null=True)),
                ('asset_type', models.CharField(default=b'text', max_length=20, choices=[(b'text', b'text'), (b'survey_block', b'survey_block'), (b'choice_list', b'choice list')])),
                ('uid', models.CharField(default=b'', max_length=8)),
                ('collection', models.ForeignKey(related_name='survey_assets', to='kpi.Collection', null=True)),
                ('owner', models.ForeignKey(related_name='survey_assets', to=settings.AUTH_USER_MODEL, null=True)),
            ],
            options={
                'ordering': ('created',),
            },
            bases=(models.Model,),
        ),
    ]
