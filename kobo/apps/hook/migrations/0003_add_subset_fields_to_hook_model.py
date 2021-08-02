# coding: utf-8
from django.db import migrations, models
import django.contrib.postgres.fields


class Migration(migrations.Migration):

    dependencies = [
        ('hook', '0002_add_email_notifications_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='hook',
            name='subset_fields',
            field=django.contrib.postgres.fields.ArrayField(default=list,
                                                            base_field=models.CharField(max_length=500),
                                                            size=None),
        ),
    ]
