# coding: utf-8
import datetime

from django.conf import settings
from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import migrations, models
import markdownx.models
import private_storage.storage.files

import kpi.fields


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='InAppMessage',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('uid', kpi.fields.KpiUidField(uid_prefix='iam')),
                ('title', models.CharField(max_length=255)),
                ('snippet', markdownx.models.MarkdownxField()),
                ('body', markdownx.models.MarkdownxField()),
                ('published', models.BooleanField(default=False, help_text='When published, this message appears to all users. It otherwise appears only to the last editor')),
                ('valid_from', models.DateTimeField(default=datetime.datetime(1970, 1, 1, 0, 0))),
                ('valid_until', models.DateTimeField(default=datetime.datetime(1970, 1, 1, 0, 0))),
                ('last_editor', models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE)),
            ],
        ),
        migrations.CreateModel(
            name='InAppMessageFile',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('content', private_storage.fields.PrivateFileField(storage=private_storage.storage.files.PrivateFileSystemStorage(), upload_to='__in_app_message/%Y/%m/%d/')),
            ],
        ),
        migrations.CreateModel(
            name='InAppMessageUserInteractions',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('interactions', JSONBField(default=dict)),
                ('message', models.ForeignKey(to='help.InAppMessage',
                                              on_delete=models.CASCADE)),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL,
                                           on_delete=models.CASCADE)),
            ],
        ),
        migrations.AlterUniqueTogether(
            name='inappmessageuserinteractions',
            unique_together=set([('message', 'user')]),
        ),
    ]
