# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import jsonfield.fields
from kpi.models import ObjectPermissionMixin
import mptt.fields
from django.conf import settings
import taggit.managers


class Migration(migrations.Migration):

    dependencies = [
        ('auth', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('contenttypes', '0001_initial'),
        ('taggit', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Asset',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(default=b'', max_length=255, blank=True)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now=True)),
                ('content', jsonfield.fields.JSONField(null=True)),
                ('asset_type', models.CharField(default=b'text', max_length=20, choices=[(b'text', b'text'), (b'survey_block', b'survey_block'), (b'choice_list', b'choice list')])),
                ('editors_can_change_permissions', models.BooleanField(default=True)),
                ('uid', models.CharField(default=b'', max_length=22)),
                ('owner', models.ForeignKey(related_name='assets', to=settings.AUTH_USER_MODEL, null=True)),
            ],
            options={
                'ordering': ('-date_modified',),
                'permissions': (('view_asset', 'Can view asset'), ('share_asset', "Can change this asset's sharing settings")),
            },
            bases=(ObjectPermissionMixin, models.Model),
        ),
        migrations.CreateModel(
            name='Collection',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(max_length=255)),
                ('editors_can_change_permissions', models.BooleanField(default=True)),
                ('uid', models.CharField(default=b'', max_length=22)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now=True)),
                ('lft', models.PositiveIntegerField(editable=False, db_index=True)),
                ('rght', models.PositiveIntegerField(editable=False, db_index=True)),
                ('tree_id', models.PositiveIntegerField(editable=False, db_index=True)),
                ('level', models.PositiveIntegerField(editable=False, db_index=True)),
                ('owner', models.ForeignKey(related_name='owned_collections', to=settings.AUTH_USER_MODEL)),
                ('parent', mptt.fields.TreeForeignKey(related_name='children', blank=True, to='kpi.Collection', null=True)),
                ('tags', taggit.managers.TaggableManager(to='taggit.Tag', through='taggit.TaggedItem', help_text='A comma-separated list of tags.', verbose_name='Tags')),
            ],
            options={
                'ordering': ('-date_modified',),
                'permissions': (('view_collection', 'Can view collection'), ('share_collection', "Can change this collection's sharing settings")),
            },
            bases=(ObjectPermissionMixin, models.Model),
        ),
        migrations.CreateModel(
            name='ImportTask',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('data', jsonfield.fields.JSONField()),
                ('status', models.CharField(default=b'created', max_length=32, choices=[(b'created', b'created'), (b'processing', b'processing'), (b'complete', b'complete')])),
                ('uid', models.CharField(default=b'', max_length=22)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='ObjectPermission',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('deny', models.BooleanField(default=False, help_text=b'Blocks inheritance of this permission when set to True')),
                ('inherited', models.BooleanField(default=False)),
                ('object_id', models.PositiveIntegerField()),
                ('uid', models.CharField(default=b'', max_length=22)),
                ('content_type', models.ForeignKey(to='contenttypes.ContentType')),
                ('permission', models.ForeignKey(to='auth.Permission')),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.AlterUniqueTogether(
            name='objectpermission',
            unique_together=set([('user', 'permission', 'deny', 'inherited', 'object_id', 'content_type')]),
        ),
        migrations.AddField(
            model_name='asset',
            name='parent',
            field=models.ForeignKey(related_name='assets', to='kpi.Collection', null=True),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='asset',
            name='tags',
            field=taggit.managers.TaggableManager(to='taggit.Tag', through='taggit.TaggedItem', help_text='A comma-separated list of tags.', verbose_name='Tags'),
            preserve_default=True,
        ),
    ]
