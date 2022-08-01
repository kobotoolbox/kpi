from django.db import migrations
import kpi.fields.lazy_default_jsonb
import kpi.models.asset_file
import private_storage.fields
import private_storage.storage.files


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0041_asset_advanced_features'),
    ]

    operations = [
        migrations.AddField(
            model_name='asset',
            name='known_cols',
            field=kpi.fields.lazy_default_jsonb.LazyDefaultJSONBField(default=dict),
        ),
    ]
