from django.db import migrations, models

from kpi.fields.kpi_uid import KpiUidField, UUID_LENGTH


def add_uid_to_attachment(apps, schema_editor):
    Attachment = apps.get_model('logger', 'Attachment')
    batch_size = 2000
    qs = Attachment.objects.only('uid').filter(uid='')
    batch = []
    for attachment in qs.iterator(chunk_size=batch_size):
        attachment.uid = KpiUidField.generate_unique_id('at')
        batch.append(attachment)
        if len(batch) >= batch_size:
            Attachment.objects.bulk_update(batch, ['uid'])
            batch = []
    if batch:
        Attachment.objects.bulk_update(batch, ['uid'])


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0043_attachment_date_created_attachment_date_modified'),
    ]

    operations = [
        migrations.AddField(
            model_name='attachment',
            name='uid',
            field=models.CharField(
                default='',
                max_length=UUID_LENGTH + 2,
            ),
        ),
        migrations.RunPython(add_uid_to_attachment, noop),
        migrations.AlterField(
            model_name='attachment',
            name='uid',
            field=KpiUidField(uid_prefix='at'),
        ),
    ]
