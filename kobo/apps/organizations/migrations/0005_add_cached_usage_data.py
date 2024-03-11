from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0004_remove_organization_uid'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='asr_seconds_month',
            field=models.PositiveIntegerField(blank=True, default=None, null=True),
        ),
        migrations.AddField(
            model_name='organization',
            name='asr_seconds_year',
            field=models.PositiveIntegerField(blank=True, default=None, null=True),
        ),
        migrations.AddField(
            model_name='organization',
            name='mt_characters_month',
            field=models.PositiveIntegerField(blank=True, default=None, null=True),
        ),
        migrations.AddField(
            model_name='organization',
            name='mt_characters_year',
            field=models.PositiveIntegerField(blank=True, default=None, null=True),
        ),
        migrations.AddField(
            model_name='organization',
            name='usage_updated',
            field=models.DateTimeField(blank=True, default=None, null=True),
        ),
    ]
