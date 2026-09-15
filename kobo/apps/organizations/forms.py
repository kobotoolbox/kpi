from django import forms
from django.core.exceptions import ValidationError

from .models import OrganizationUser


class OrgUserAdminForm(forms.ModelForm):
    class Meta:
        model = OrganizationUser
        fields = '__all__'

    def clean(self):
        cleaned_data = super().clean()
        organization = cleaned_data.get('organization')
        user = cleaned_data.get('user')
        if not organization.is_owner(user) and not organization.is_mmo:
            raise ValidationError(
                'Users cannot be added to an organization that is not multi-member'
            )

        previous_organization = user.organization
        cleaned_data['previous_organization'] = (
            previous_organization
            if previous_organization and previous_organization != organization
            else None
        )
        return cleaned_data
