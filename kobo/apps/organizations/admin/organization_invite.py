from django.contrib import admin
from ..models import OrganizationInvitation


@admin.register(OrganizationInvitation)
class OrgInvitationAdmin(admin.ModelAdmin):
    pass
