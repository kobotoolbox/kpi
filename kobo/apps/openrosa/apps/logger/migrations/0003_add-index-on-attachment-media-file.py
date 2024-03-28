# coding: utf-8
from django.db import migrations, models
import kobo.apps.openrosa.apps.logger.models.attachment


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0002_attachment_filename_length'),
    ]

    operations = [
        migrations.AlterField(
            model_name='attachment',
            name='media_file',
            field=models.FileField(max_length=380, upload_to=kobo.apps.openrosa.apps.logger.models.attachment.upload_to, db_index=True),
        ),
    ]
