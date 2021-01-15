# coding: utf-8
import django.utils.timezone
import private_storage.fields
import private_storage.storage.files
from django.conf import settings
from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import migrations, models

import kpi.fields
import kpi.models.asset_file


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('kpi', '0021_map-custom-styles'),
    ]

    operations = [
        migrations.CreateModel(
            name='AssetFile',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('uid', kpi.fields.KpiUidField(uid_prefix='af')),
                ('file_type', models.CharField(max_length=32, choices=[('map_layer', 'map_layer')])),
                ('name', models.CharField(max_length=255)),
                ('date_created', models.DateTimeField(default=django.utils.timezone.now)),
                ('content', private_storage.fields.PrivateFileField(storage=private_storage.storage.files.PrivateFileSystemStorage(),
                                                                    max_length=380, upload_to=kpi.models.asset_file.upload_to)),
                ('metadata', JSONBField(default=dict)),
            ],
        ),
        # Why did `manage.py makemigrations` create these as separate operations?
        migrations.AddField(
            model_name='assetfile',
            name='asset',
            field=models.ForeignKey(related_name='asset_files', to='kpi.Asset', on_delete=models.CASCADE),
        ),
        migrations.AddField(
            model_name='assetfile',
            name='user',
            field=models.ForeignKey(related_name='asset_files', to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE),
        ),
    ]
