# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import jsonfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0004_auto_20150218_1733'),
    ]

    operations = [
        migrations.AlterIndexTogether(
            name='surveyassetrevision',
            index_together=None,
        ),
        migrations.RemoveField(
            model_name='surveyassetrevision',
            name='revision',
        ),
        migrations.DeleteModel(
            name='SurveyAssetRevision',
        ),
        migrations.RemoveField(
            model_name='surveyasset',
            name='body',
        ),
        migrations.RemoveField(
            model_name='surveyasset',
            name='version_uid',
        ),
        migrations.AddField(
            model_name='surveyasset',
            name='additional_sheets',
            field=jsonfield.fields.JSONField(null=True),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='surveyasset',
            name='content',
            field=jsonfield.fields.JSONField(null=True),
            preserve_default=True,
        ),
        migrations.AlterField(
            model_name='surveyasset',
            name='asset_type',
            field=models.CharField(default=b'text', max_length=20, choices=[(b'text', b'text'), (b'survey_block', b'survey_block'), (b'choice_list', b'choice list')]),
            preserve_default=True,
        ),
    ]
