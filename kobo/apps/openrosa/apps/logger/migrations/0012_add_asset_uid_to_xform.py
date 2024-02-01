# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0011_add-index-to-instance-uuid_and_xform_uuid'),
    ]

    operations = [
        migrations.AddField(
            model_name='xform',
            name='kpi_asset_uid',
            field=models.CharField(max_length=32, null=True),
        ),
    ]
