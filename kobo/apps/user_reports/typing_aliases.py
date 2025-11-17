from typing import Optional

from django.db.models import QuerySet

from kobo.apps.organizations.models import Organization

OrganizationIterator = Optional[QuerySet[Organization] | list[Organization]]
