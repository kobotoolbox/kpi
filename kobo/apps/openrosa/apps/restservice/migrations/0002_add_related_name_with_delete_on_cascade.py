# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restservice', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='restservice',
            name='name',
            field=models.CharField(max_length=50, choices=[('f2dhis2', 'f2dhis2'), ('generic_json', 'JSON POST'), ('generic_xml', 'XML POST'), ('bamboo', 'bamboo'), ('kpi_hook', 'KPI Hook POST')]),
        ),
        migrations.AlterField(
            model_name='restservice',
            name='xform',
            field=models.ForeignKey(related_name='restservices', to='logger.XForm', on_delete=models.CASCADE),
        ),
    ]
