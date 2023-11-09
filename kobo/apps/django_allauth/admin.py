from allauth.socialaccount.admin import SocialAppForm, SocialAppAdmin
from allauth.socialaccount.models import SocialApp
from django.contrib import admin
from django.core.exceptions import ValidationError


class RequireProviderIdSocialAppForm(SocialAppForm):
    def __init__(self, *args, **kwargs):
        super(SocialAppForm, self).__init__(*args, **kwargs)
        # require the provider_id in the admin, since we can't make it required on allauth's model
        self.fields['provider_id'].required = True

    def clean(self):
        reserved_keywords = ['kobo']
        provider_id = self.cleaned_data.get('provider_id')
        # we check this already for the ID in kobo/apps/accounts/apps.py
        if provider_id in reserved_keywords:
            raise ValidationError(f'`{provider_id}` is not a valid value for the `provider_id` setting.')

class RequireProviderIdSocialAppAdmin(SocialAppAdmin):
    form = RequireProviderIdSocialAppForm

    class Meta:
        proxy = True


admin.site.unregister(SocialApp)
admin.site.register(SocialApp, RequireProviderIdSocialAppAdmin)
