# -*- coding: utf-8 -*-
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0002_auto_20160205_1915'),
    ]

    operations = [
        migrations.AddField(
            model_name='metadata',
            name='from_kpi',
            field=models.BooleanField(default=False),
        ),
    ]
