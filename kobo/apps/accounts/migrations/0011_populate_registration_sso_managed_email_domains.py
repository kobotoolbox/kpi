from django.db import migrations


def populate_registration_sso_managed_email_domains(apps, schema_editor):
    from kobo.apps.accounts.signals import update_managed_sso_email_domains

    update_managed_sso_email_domains()


def reverse_populate(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_socialappcustomdata_managed_socialappmanageddomain'),
        ('constance', '0003_drop_pickle'),
    ]

    operations = [
        migrations.RunPython(
            populate_registration_sso_managed_email_domains,
            reverse_code=reverse_populate,
        ),
    ]
