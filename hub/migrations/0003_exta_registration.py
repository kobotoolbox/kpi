# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import jsonfield.fields
from django.conf import settings


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
                ('data', jsonfield.fields.JSONField()),
                ('user', models.OneToOneField(to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='UserRegistrationChoice',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('field_name', models.CharField(unique=True, max_length=50)),
                ('json_data', jsonfield.fields.JSONField()),
                ('value_label_path', models.CharField(max_length=100)),
            ],
        ),
        migrations.AlterField(
            model_name='formbuilderpreference',
            name='preferred_builder',
            field=models.CharField(default=b'K', max_length=1, choices=[(b'K', b'kpi'), (b'D', b'dkobo')]),
        ),
    ]
