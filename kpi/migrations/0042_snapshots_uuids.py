from django.db import migrations, models
import django.db.models.deletion
import kpi.models.asset_file
import private_storage.fields
import private_storage.storage.files


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0041_asset_advanced_features'),
    ]

    operations = [
        migrations.AddField(
            model_name='assetsnapshot',
            name='submission_uuid',
            field=models.CharField(max_length=41, null=True),
        ),
        # changed OneToOneField to ForeignKey
        migrations.AlterField(
            model_name='assetsnapshot',
            name='asset_version',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to='kpi.AssetVersion'),
        ),
    ]
