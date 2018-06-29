# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hook', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='hook',
            old_name='destination_url',
            new_name='endpoint',
        ),
        migrations.AddField(
            model_name='hook',
            name='security_level',
            field=models.CharField(default=b'no_auth', max_length=10, choices=[(b'no_auth', b'no_auth'), (b'basic_auth', b'basic_auth')]),
        ),
    ]
