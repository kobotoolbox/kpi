from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('languages', '0002_transcriptionservicelanguagem2m_location_code_and_more'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='transcriptionservice',
            options={},
        ),
        migrations.AlterModelOptions(
            name='translationservice',
            options={},
        ),
        migrations.AddField(
            model_name='transcriptionservice',
            name='priority',
            field=models.PositiveSmallIntegerField(
                default=100, help_text='Lower values come first'
            ),
        ),
        migrations.AddField(
            model_name='translationservice',
            name='priority',
            field=models.PositiveSmallIntegerField(
                default=100, help_text='Lower values come first'
            ),
        ),
    ]
