# Generated by Django 3.2.15 on 2023-02-22 15:03

from django.db import migrations, models
import django.db.models.deletion
import kobo.apps.openrosa.apps.logger.fields


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0025_delete_submissioncounter'),
    ]

    operations = [
        migrations.AddField(
            model_name='xform',
            name='pending_delete',
            field=models.BooleanField(default=False),
        )
    ]
