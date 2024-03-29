# Generated by Django 3.2.15 on 2023-06-28 19:32

from django.db import migrations, models
import hub.models


class Migration(migrations.Migration):

    dependencies = [
        ('hub', '0013_alter_constance_config'),
    ]

    operations = [
        migrations.AlterField(
            model_name='configurationfile',
            name='content',
            field=models.FileField(
                help_text='Stored in a PUBLIC location where authentication '
                          'is NOT required to access common passwords file.',
                upload_to=hub.models._configuration_file_upload_to,
            ),
        ),
        migrations.AlterField(
            model_name='configurationfile',
            name='slug',
            field=models.CharField(choices=[('logo', 'logo'), ('logo_small', 'logo_small'), ('login_background', 'login_background'), ('common_passwords_file', 'common_passwords_file')], max_length=32, unique=True),
        ),
    ]
