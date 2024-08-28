# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0013_remove_bamboo_and_ziggy_instance'),
    ]

    operations = [
        migrations.AddField(
            model_name='attachment',
            name='media_file_size',
            field=models.PositiveIntegerField(null=True, blank=True),
        ),
    ]
