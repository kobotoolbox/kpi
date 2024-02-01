# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('viewer', '0002_auto_20160205_1915'),
    ]

    operations = [
        migrations.AlterField(
            model_name='export',
            name='export_type',
            field=models.CharField(default='xls', max_length=10, choices=[('xls', 'Excel'), ('csv', 'CSV'), ('gdoc', 'GDOC'), ('zip', 'ZIP'), ('kml', 'kml'), ('csv_zip', 'CSV ZIP'), ('sav_zip', 'SAV ZIP'), ('sav', 'SAV'), ('external', 'Excel'), ('analyser', 'Analyser')]),
        ),
    ]
