# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations, ProgrammingError, OperationalError
from django.conf import settings


def south_forwards(apps, schema_editor):
    statement = "INSERT INTO south_migrationhistory (app_name, migration, " \
                "applied) VALUES ('hub', '0002_formbuilderpreference', NOW());"
    try:
        schema_editor.execute(statement, params=None)
    # Different backends raise different exceptions when a table is missing
    except (ProgrammingError, OperationalError):
        # South may have never touched this database
        pass

def south_backwards(apps, schema_editor):
    statement = "DELETE FROM south_migrationhistory WHERE app_name='hub' " \
                "AND migration='0002_formbuilderpreference';"
    try:
        schema_editor.execute(statement, params=None)
    except (ProgrammingError, OperationalError):
        pass


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
                ('preferred_builder', models.CharField(default=b'D', max_length=1, choices=[(b'K', b'kpi'), (b'D', b'dkobo')])),
                ('user', models.OneToOneField(to=settings.AUTH_USER_MODEL)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.RunPython(south_forwards, south_backwards),
    ]
