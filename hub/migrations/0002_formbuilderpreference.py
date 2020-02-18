# coding: utf-8
from django.db import models, migrations, connection
from django.conf import settings


def south_forwards(apps, schema_editor):
    statement = "INSERT INTO south_migrationhistory (app_name, migration, " \
                "applied) VALUES ('hub', '0002_formbuilderpreference', NOW());"
    # South may have never touched this database
    if 'south_migrationhistory' in connection.introspection.table_names():
        schema_editor.execute(statement, params=None)


def south_backwards(apps, schema_editor):
    statement = "DELETE FROM south_migrationhistory WHERE app_name='hub' " \
                "AND migration='0002_formbuilderpreference';"
    if 'south_migrationhistory' in connection.introspection.table_names():
        schema_editor.execute(statement, params=None)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('hub', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='FormBuilderPreference',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('preferred_builder', models.CharField(default='D', max_length=1, choices=[('K', 'kpi'), ('D', 'dkobo')])),
                ('user', models.OneToOneField(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.RunPython(south_forwards, south_backwards),
    ]
