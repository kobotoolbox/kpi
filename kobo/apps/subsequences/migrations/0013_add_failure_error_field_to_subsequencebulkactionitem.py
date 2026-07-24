from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('subsequences', '0012_add_progress_field_to_subsequencebulkaction'),
    ]

    operations = [
        migrations.AddField(
            model_name='subsequencebulkactionitem',
            name='failure_error',
            field=models.TextField(blank=True, null=True),
        ),
    ]
