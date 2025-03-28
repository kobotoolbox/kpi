import sys

from django.db import transaction
from djstripe.models import Customer, Subscription, Price
from xlrd import open_workbook

from kobo.apps.organizations.models import Organization, OrganizationUser
from kobo.apps.kobo_auth.shortcuts import User


def run(*args):
    price = args[0]
    file = args[1]

    if not Price.objects.filter(id=price).exists():
        sys.stdout.write('Enter a valid price')
        return

    source_data = open_workbook(file)
    source_sheet = source_data.sheet_by_index(0)
    target_org_column = 5

    for row in range(1, source_sheet.nrows):
        new_org_id = source_sheet.cell_value(row, target_org_column)
        username = source_sheet.cell_value(row, 0)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            sys.stderr.write(f'{username},No user found\n')
            continue

        if not (org := get_organization(user, new_org_id)):
            sys.stderr.write(f'{new_org_id},No organization found\n')
            continue

        try:
            org_owner = org.owner
        except Organization.owner.RelatedObjectDoesNotExist:
            sys.stderr.write(f'{new_org_id},Organization has no owner\n')
            continue

        try:
            assert org.is_owner(user)
        except AssertionError:
            sys.stderr.write(
                f'{new_org_id},{username} is not the owner of organization {org.name}\n'
            )
            continue

        with transaction.atomic():
            OrganizationUser.objects.filter(organization=org).exclude(
                id=org_owner.organization_user_id
            ).delete()

            customer, _ = Customer.get_or_create(subscriber=org)
            if (
                Subscription.objects.filter(customer=customer)
                .exclude(status="canceled")
                .exists()
            ):
                sys.stderr.write(f'{new_org_id},Has existing subscription\n')
                continue
            customer.subscribe(price=price)
            sys.stdout.write(f'{new_org_id},Has been subscribed\n')


def get_organization(user, new_org_id):
    if organization := Organization.objects.filter(
        organization_users__user=user, id=new_org_id
    ).first():
        return organization
