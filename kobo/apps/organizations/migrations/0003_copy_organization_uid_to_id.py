from django.db import migrations
from django.db.models import F


'''
`\d organizations_organization` says:

    TABLE "organizations_organizationinvitation" CONSTRAINT "…" FOREIGN KEY (organization_id) REFERENCES organizations_organization(id) DEFERRABLE INITIALLY DEFERRED
    TABLE "organizations_organizationowner" CONSTRAINT "…" FOREIGN KEY (organization_id) REFERENCES organizations_organization(id) DEFERRABLE INITIALLY DEFERRED
    TABLE "organizations_organizationuser" CONSTRAINT "…" FOREIGN KEY (organization_id) REFERENCES organizations_organization(id) DEFERRABLE INITIALLY DEFERRED
'''

def copy_uid_to_id(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    related_models = [
        apps.get_model("organizations", "OrganizationInvitation"),
        apps.get_model("organizations", "OrganizationOwner"),
        apps.get_model("organizations", "OrganizationUser"),
    ]
    djstripe_installed = apps.is_installed("djstripe")
    if djstripe_installed:
        customer_model = apps.get_model("djstripe", "Customer")
    orgs = Organization.objects.only('id', 'uid').all()
    for org in orgs:
        for model in related_models:
            model.objects.filter(organization=org).update(
                organization=org.uid
            )
        if djstripe_installed:
            customer_model.objects.filter(subscriber=org.id).update(
                subscriber=org.uid
            )
    Organization.objects.update(id=F('uid'))


def copy_id_to_uid_and_revert_to_integer_ids(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    related_models = [
        apps.get_model("organizations", "OrganizationInvitation"),
        apps.get_model("organizations", "OrganizationOwner"),
        apps.get_model("organizations", "OrganizationUser"),
    ]
    djstripe_installed = apps.is_installed("djstripe")
    if djstripe_installed:
        customer_model = apps.get_model("djstripe", "Customer")
    Organization.objects.update(uid=F('id'))
    for new_id, org in enumerate(
        Organization.objects.only('id').all(), start=1
    ):
        for model in related_models:
            model.objects.filter(organization=org).update(
                organization=new_id
            )
        if djstripe_installed:
            customer_model.objects.filter(subscriber=org.uid).update(
                subscriber=new_id
            )
        Organization.objects.filter(id=org.id).update(id=new_id)


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0002_alter_organization_id_to_kpiuidfield'),
    ]

    operations = [
        migrations.RunPython(copy_uid_to_id, copy_id_to_uid_and_revert_to_integer_ids),
    ]
