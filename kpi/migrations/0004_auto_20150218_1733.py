# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('reversion', '0001_initial'),
        ('kpi', '0003_auto_20150213_1832'),
    ]

    operations = [
        migrations.CreateModel(
            name='SurveyAssetRevision',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('asset_uid', models.CharField(max_length=20)),
                ('version_uid', models.CharField(max_length=20)),
                ('revision', models.ForeignKey(to='reversion.Revision')),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.AlterIndexTogether(
            name='surveyassetrevision',
            index_together=set([('asset_uid', 'version_uid')]),
        ),
        migrations.RenameField(
            model_name='collection',
            old_name='uuid',
            new_name='uid',
        ),
        migrations.RemoveField(
            model_name='surveyasset',
            name='uuid',
        ),
        migrations.AddField(
            model_name='surveyasset',
            name='version_uid',
            field=models.CharField(default=b'', max_length=5),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='surveyasset',
            name='uid',
            field=models.CharField(default=b'', max_length=8),
            preserve_default=True,
        ),
    ]
