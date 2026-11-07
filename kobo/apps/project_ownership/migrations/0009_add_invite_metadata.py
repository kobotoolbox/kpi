from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('project_ownership', '0008_transferstatuserror_level_and_verbose_names'),
    ]

    operations = [
        migrations.AddField(
            model_name='invite',
            name='metadata',
            field=models.JSONField(default=dict),
        ),
    ]
