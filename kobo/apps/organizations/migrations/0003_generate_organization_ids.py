from django.db import migrations
from kpi.fields.kpi_uid import KpiUidField


class Migration(migrations.Migration):

    @staticmethod
    def generate_organization_ids(apps, schema_editor):
        Organization = apps.get_model("organizations", "Organization")
        for organization in Organization.objects.all():
            organization.id = KpiUidField.generate_unique_id('org')
            organization.save()
        for organization in Organization.objects.all():
            if organization.id.isdigit():
                organization.delete()

    dependencies = [
        ('organizations', '0002_remove_uid_and_change_id'),
    ]

    operations = [
        migrations.RunPython(
            generate_organization_ids,
            migrations.RunPython.noop
        )
    ]
