from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('kpi', '0029_copy_collections_to_assets'),
    ]

    operations = [
        migrations.AlterField(
            model_name='asset',
            name='parent',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='children',
                to='kpi.Asset',
            ),
        ),
        migrations.DeleteModel(name='Collection',),
        migrations.DeleteModel(name='UserCollectionSubscription',),
    ]
