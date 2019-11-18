# -*- coding: utf-8 -*-
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hook', '0003_add_subset_fields_to_hook_model'),
    ]

    operations = [
        migrations.AddField(
            model_name='hook',
            name='payload_template',
            field=models.TextField(null=True, blank=True),
        ),
    ]
