from django.db import migrations
from kpi.fields import KpiUidField


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='organization',
            name='id',
            field=KpiUidField(primary_key=True, uid_prefix='org'),
        ),
    ]
