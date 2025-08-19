# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0009_add_posted_to_kpi_field_to_logger_instance'),
    ]

    operations = [
        migrations.AddField(
            model_name='attachment',
            name='media_file_basename',
            field=models.CharField(db_index=True, max_length=260, null=True, blank=True),
        ),
    ]
