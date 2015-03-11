# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import mptt.fields
import jsonfield.fields
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Collection',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(max_length=255)),
                ('editors_can_change_permissions', models.BooleanField(default=True)),
                ('uid', models.CharField(default=b'', max_length=22)),
                ('lft', models.PositiveIntegerField(editable=False, db_index=True)),
                ('rght', models.PositiveIntegerField(editable=False, db_index=True)),
                ('tree_id', models.PositiveIntegerField(editable=False, db_index=True)),
                ('level', models.PositiveIntegerField(editable=False, db_index=True)),
                ('owner', models.ForeignKey(related_name='owned_collections', to=settings.AUTH_USER_MODEL)),
                ('parent', mptt.fields.TreeForeignKey(related_name='children', blank=True, to='kpi.Collection', null=True)),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='CollectionUser',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('role_type', models.CharField(default=b'denied', max_length=20, choices=[(b'denied', b'No access'), (b'viewer', b'Can view'), (b'editor', b'Can edit')])),
                ('collection', models.ForeignKey(to='kpi.Collection')),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='SurveyAsset',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(default=b'', max_length=255, blank=True)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now=True)),
                ('content', jsonfield.fields.JSONField(null=True)),
                ('additional_sheets', jsonfield.fields.JSONField(null=True)),
                ('settings', jsonfield.fields.JSONField(null=True)),
                ('asset_type', models.CharField(default=b'text', max_length=20, choices=[(b'text', b'text'), (b'survey_block', b'survey_block'), (b'choice_list', b'choice list')])),
                ('editors_can_change_permissions', models.BooleanField(default=True)),
                ('uid', models.CharField(default=b'', max_length=22)),
                ('collection', models.ForeignKey(related_name='survey_assets', to='kpi.Collection', null=True)),
                ('owner', models.ForeignKey(related_name='survey_assets', to=settings.AUTH_USER_MODEL, null=True)),
            ],
            options={
                'ordering': ('date_created',),
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='SurveyAssetUser',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('role_type', models.CharField(default=b'denied', max_length=20, choices=[(b'denied', b'No access'), (b'viewer', b'Can view'), (b'editor', b'Can edit')])),
                ('survey_asset', models.ForeignKey(to='kpi.SurveyAsset')),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.AddField(
            model_name='surveyasset',
            name='users',
            field=models.ManyToManyField(related_name='+', through='kpi.SurveyAssetUser', to=settings.AUTH_USER_MODEL),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='collection',
            name='users',
            field=models.ManyToManyField(related_name='+', through='kpi.CollectionUser', to=settings.AUTH_USER_MODEL),
            preserve_default=True,
        ),
    ]
