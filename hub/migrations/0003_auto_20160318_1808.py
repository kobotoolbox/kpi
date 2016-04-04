# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import jsonfield.fields
from django.conf import settings


def create_extrauserdetails(apps, schema_editor):
    ExtraUserDetail = apps.get_model('hub', 'ExtraUserDetail')
    User = apps.get_model('auth', 'User')
    for user in User.objects.all():
        ExtraUserDetail.objects.get_or_create(user=user)

class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('hub', '0002_formbuilderpreference'),
    ]

    operations = [
        migrations.CreateModel(
            name='ExtraUserDetail',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('data', jsonfield.fields.JSONField(default={})),
                ('user', models.OneToOneField(related_name='extra_details', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AlterField(
            model_name='formbuilderpreference',
            name='preferred_builder',
            field=models.CharField(default=b'K', max_length=1, choices=[(b'K', b'kpi'), (b'D', b'dkobo')]),
        ),
        migrations.RunPython(create_extrauserdetails),
    ]
