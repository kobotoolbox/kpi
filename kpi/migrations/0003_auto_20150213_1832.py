# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import jsonfield.fields
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0002_auto_20150213_1652'),
    ]

    operations = [
        migrations.RenameField(
            model_name='surveyasset',
            old_name='code',
            new_name='body',
        ),
        migrations.RemoveField(
            model_name='surveyasset',
            name='highlighted',
        ),
        migrations.RemoveField(
            model_name='surveyasset',
            name='language',
        ),
        migrations.RemoveField(
            model_name='surveyasset',
            name='linenos',
        ),
        migrations.RemoveField(
            model_name='surveyasset',
            name='style',
        ),
        migrations.AddField(
            model_name='surveyasset',
            name='asset_type',
            field=models.CharField(default=b'text', max_length=20, choices=[(b'text', b'text'), (b'survey', b'survey'), (b'block', b'block'), (b'choice_list', b'choice list')]),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='surveyasset',
            name='settings',
            field=jsonfield.fields.JSONField(null=True),
            preserve_default=True,
        ),
        migrations.AlterField(
            model_name='surveyasset',
            name='owner',
            field=models.ForeignKey(related_name='survey_assets', to=settings.AUTH_USER_MODEL, null=True),
            preserve_default=True,
        ),
    ]
