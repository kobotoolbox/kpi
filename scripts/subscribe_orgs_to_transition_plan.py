import sys

from djstripe.models import Customer, Subscription, Price
from xlrd import open_workbook

from kobo.apps.organizations.models import Organization, OrganizationUser


def run(*args):
    price = args[0]
    file = args[1]

    if not Price.objects.filter(id=price).exists():
        print("Enter a valid price")
        return

    source_data = open_workbook(file)
    source_sheet = source_data.sheet_by_index(0)
    target_org_column = 5

    for row in range(1, source_sheet.nrows):
        org_id = source_sheet.cell_value(row, target_org_column)

        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            sys.stdout.write(f'{org_id},No organization found\n')
            continue

        try:
            org_owner = org.owner
        except Organization.owner.RelatedObjectDoesNotExist:
            sys.stdout.write(f'{org_id},Organization has no owner\n')
            continue

        OrganizationUser.objects.filter(organization=org).exclude(
            id=org_owner.organization_user_id
        ).delete()

        customer, _ = Customer.get_or_create(subscriber=org)
        if (
            Subscription.objects.filter(customer=customer)
            .exclude(status="canceled")
            .exists()
        ):
            sys.stdout.write(f'{org_id},Has existing subscription\n')
            continue
        customer.subscribe(price=price)
