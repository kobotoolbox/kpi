# coding: utf-8
from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('taggit', '0001_initial'),
        ('kpi', '0004_default_permissions_1910'),
    ]

    operations = [
        migrations.CreateModel(
            name='TagUid',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('uid', models.CharField(default='', max_length=22, blank=True)),
                ('tag', models.OneToOneField(to='taggit.Tag', on_delete=models.CASCADE)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
    ]
