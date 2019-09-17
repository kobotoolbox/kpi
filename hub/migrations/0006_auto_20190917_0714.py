# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import jsonbfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('hub', '0005_perusersetting'),
    ]

    operations = [
        migrations.AlterField(
            model_name='perusersetting',
            name='name',
            field=models.CharField(default=b'INTERCOM_APP_ID', unique=True, max_length=255),
        ),
        migrations.AlterField(
            model_name='perusersetting',
            name='user_queries',
            field=jsonbfield.fields.JSONField(help_text='A JSON representation of a *list* of Django queries, e.g. `[{"email__iendswith": "@kobotoolbox.org"}, {"email__iendswith": "@kbtdev.org"}]`. A matching user is one who would be returned by ANY of the queries in the list.'),
        ),
    ]
