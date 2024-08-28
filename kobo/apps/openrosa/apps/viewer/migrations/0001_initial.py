# coding: utf-8
from django.db import migrations, models
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ColumnRename',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('xpath', models.CharField(unique=True, max_length=255)),
                ('column_name', models.CharField(max_length=32)),
            ],
        ),
        migrations.CreateModel(
            name='Export',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('created_on', models.DateTimeField(auto_now_add=True)),
                ('filename', models.CharField(max_length=255, null=True, blank=True)),
                ('filedir', models.CharField(max_length=255, null=True, blank=True)),
                ('export_type', models.CharField(default='xls', max_length=10, choices=[('xls', 'Excel'), ('csv', 'CSV'), ('gdoc', 'GDOC'), ('zip', 'ZIP'), ('kml', 'kml'), ('csv_zip', 'CSV ZIP'), ('sav_zip', 'SAV ZIP'), ('sav', 'SAV'), ('external', 'Excel')])),
                ('task_id', models.CharField(max_length=255, null=True, blank=True)),
                ('time_of_last_submission', models.DateTimeField(default=None, null=True)),
                ('internal_status', models.SmallIntegerField(default=0, max_length=1)),
                ('export_url', models.URLField(default=None, null=True)),
            ],
        ),
        migrations.CreateModel(
            name='InstanceModification',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('action', models.CharField(max_length=50)),
                ('xpath', models.CharField(max_length=50)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_modified', models.DateTimeField(auto_now=True)),
                ('instance', models.ForeignKey(related_name='modifications', to='logger.Instance', on_delete=models.CASCADE)),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL, null=True, on_delete=models.CASCADE)),
            ],
        ),
        migrations.CreateModel(
            name='ParsedInstance',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('start_time', models.DateTimeField(null=True)),
                ('end_time', models.DateTimeField(null=True)),
                ('lat', models.FloatField(null=True)),
                ('lng', models.FloatField(null=True)),
                ('instance', models.OneToOneField(related_name='parsed_instance', to='logger.Instance', on_delete=models.CASCADE)),
            ],
        ),
        migrations.CreateModel(
            name='DataDictionary',
            fields=[
            ],
            options={
                'proxy': True,
            },
            bases=('logger.xform',),
        ),
        migrations.AddField(
            model_name='export',
            name='xform',
            field=models.ForeignKey(to='logger.XForm', on_delete=models.CASCADE),
        ),
        migrations.AlterUniqueTogether(
            name='export',
            unique_together=set([('xform', 'filename')]),
        ),
    ]
