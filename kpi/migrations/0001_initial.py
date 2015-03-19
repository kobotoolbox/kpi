# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import mptt.fields
import jsonfield.fields
from django.conf import settings
import taggit.managers


class Migration(migrations.Migration):

    dependencies = [
        ('taggit', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('contenttypes', '0001_initial'),
        ('auth', '0001_initial'),
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
                ('tags', taggit.managers.TaggableManager(to='taggit.Tag', through='taggit.TaggedItem', help_text='A comma-separated list of tags.', verbose_name='Tags')),
            ],
            options={
                'permissions': (('view_collection', 'Can view collection'), ('share_collection', "Can change this collection's sharing settings")),
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='ObjectPermission',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('deny', models.BooleanField(default=False)),
                ('inherited', models.BooleanField(default=False)),
                ('object_id', models.PositiveIntegerField()),
                ('content_type', models.ForeignKey(to='contenttypes.ContentType')),
                ('permission', models.ForeignKey(to='auth.Permission')),
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
                ('tags', taggit.managers.TaggableManager(to='taggit.Tag', through='taggit.TaggedItem', help_text='A comma-separated list of tags.', verbose_name='Tags')),
            ],
            options={
                'ordering': ('date_created',),
                'permissions': (('view_surveyasset', 'Can view survey asset'), ('share_surveyasset', "Can change this survey asset's sharing settings")),
            },
            bases=(models.Model,),
        ),
        migrations.AlterUniqueTogether(
            name='objectpermission',
            unique_together=set([('user', 'permission', 'deny', 'inherited', 'object_id', 'content_type')]),
        ),
    ]
