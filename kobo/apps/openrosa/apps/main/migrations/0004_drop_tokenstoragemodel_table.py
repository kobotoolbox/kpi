# -*- coding: utf-8 -*-
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0003_add_field_from_kpi_to_metadata'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='tokenstoragemodel',
            name='id',
        ),
        migrations.DeleteModel(
            name='TokenStorageModel',
        ),
    ]
