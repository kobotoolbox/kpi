# coding: utf-8
import django.contrib.gis.db.models.fields
import jsonfield.fields
import taggit.managers
from django.conf import settings
from django.db import migrations, models

import kobo.apps.openrosa.apps.logger.models.attachment
import kobo.apps.openrosa.apps.logger.models.xform


class Migration(migrations.Migration):

    dependencies = [
        ('taggit', '0002_auto_20150616_2121'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Attachment',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('media_file', models.FileField(upload_to=kobo.apps.openrosa.apps.logger.models.attachment.upload_to)),
                ('mimetype', models.CharField(default='', max_length=50, blank=True)),
            ],
        ),
        migrations.CreateModel(
            name='Instance',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('json', jsonfield.fields.JSONField(default={})),
                ('xml', models.TextField()),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(default=None, null=True)),
                ('status', models.CharField(default='submitted_via_web', max_length=20)),
                ('uuid', models.CharField(default='', max_length=249)),
                ('geom', django.contrib.gis.db.models.fields.GeometryCollectionField(srid=4326, null=True)),
            ],
        ),
        migrations.CreateModel(
            name='InstanceHistory',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('xml', models.TextField()),
                ('uuid', models.CharField(default='', max_length=249)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now=True)),
                ('xform_instance', models.ForeignKey(related_name='submission_history', to='logger.Instance', on_delete=models.CASCADE)),
            ],
        ),
        migrations.CreateModel(
            name='Note',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('note', models.TextField()),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now=True)),
                ('instance', models.ForeignKey(related_name='notes', to='logger.Instance', on_delete=models.CASCADE)),
            ],
            options={
                'permissions': (('view_note', 'View note'),),
            },
        ),
        migrations.CreateModel(
            name='SurveyType',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('slug', models.CharField(unique=True, max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name='XForm',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('xls', models.FileField(null=True, upload_to=kobo.apps.openrosa.apps.logger.models.xform.upload_to)),
                ('json', models.TextField(default='')),
                ('description', models.TextField(default='', null=True)),
                ('xml', models.TextField()),
                ('require_auth', models.BooleanField(default=False)),
                ('shared', models.BooleanField(default=False)),
                ('shared_data', models.BooleanField(default=False)),
                ('downloadable', models.BooleanField(default=True)),
                ('allows_sms', models.BooleanField(default=False)),
                ('encrypted', models.BooleanField(default=False)),
                ('sms_id_string', models.SlugField(default='', verbose_name='SMS ID', max_length=100, editable=False)),
                ('id_string', models.SlugField(verbose_name='ID', max_length=100, editable=False)),
                ('title', models.CharField(max_length=255, editable=False)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now=True)),
                ('last_submission_time', models.DateTimeField(null=True, blank=True)),
                ('has_start_time', models.BooleanField(default=False)),
                ('uuid', models.CharField(default='', max_length=32)),
                ('bamboo_dataset', models.CharField(default='', max_length=60)),
                ('instances_with_geopoints', models.BooleanField(default=False)),
                ('num_of_submissions', models.IntegerField(default=0)),
                ('tags', taggit.managers.TaggableManager(to='taggit.Tag', through='taggit.TaggedItem', help_text='A comma-separated list of tags.', verbose_name='Tags')),
                ('user', models.ForeignKey(related_name='xforms', to=settings.AUTH_USER_MODEL, null=True, on_delete=models.CASCADE)),
            ],
            options={
                'ordering': ('id_string',),
                'verbose_name': 'XForm',
                'verbose_name_plural': 'XForms',
                'permissions': (('view_xform', 'Can view associated data'), ('report_xform', 'Can make submissions to the form'), ('move_xform', 'Can move form between projects'), ('transfer_xform', 'Can transfer form ownership.')),
            },
        ),
        migrations.CreateModel(
            name='ZiggyInstance',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('entity_id', models.CharField(max_length=249)),
                ('instance_id', models.CharField(unique=True, max_length=249)),
                ('form_instance', models.TextField()),
                ('client_version', models.BigIntegerField(default=None, null=True)),
                ('server_version', models.BigIntegerField()),
                ('form_version', models.CharField(default='1.0', max_length=10)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now=True)),
                ('date_deleted', models.DateTimeField(default=None, null=True)),
                ('reporter', models.ForeignKey(related_name='ziggys', to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE)),
                ('xform', models.ForeignKey(related_name='ziggy_submissions', to='logger.XForm', null=True, on_delete=models.CASCADE)),
            ],
        ),
        migrations.AddField(
            model_name='instance',
            name='survey_type',
            field=models.ForeignKey(to='logger.SurveyType', on_delete=models.CASCADE),
        ),
        migrations.AddField(
            model_name='instance',
            name='tags',
            field=taggit.managers.TaggableManager(to='taggit.Tag', through='taggit.TaggedItem', help_text='A comma-separated list of tags.', verbose_name='Tags'),
        ),
        migrations.AddField(
            model_name='instance',
            name='user',
            field=models.ForeignKey(related_name='instances', to=settings.AUTH_USER_MODEL, null=True, on_delete=models.CASCADE),
        ),
        migrations.AddField(
            model_name='instance',
            name='xform',
            field=models.ForeignKey(related_name='instances', to='logger.XForm', null=True, on_delete=models.CASCADE),
        ),
        migrations.AddField(
            model_name='attachment',
            name='instance',
            field=models.ForeignKey(related_name='attachments', to='logger.Instance', on_delete=models.CASCADE),
        ),
        migrations.AlterUniqueTogether(
            name='xform',
            unique_together=set([('user', 'id_string'), ('user', 'sms_id_string')]),
        ),
    ]
