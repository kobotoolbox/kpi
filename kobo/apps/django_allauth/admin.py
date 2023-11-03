from allauth.socialaccount.admin import SocialAppForm, SocialAppAdmin
from allauth.socialaccount.models import SocialApp
from django.contrib import admin


class RequireProviderIdSocialAppForm(SocialAppForm):
    def __init__(self, *args, **kwargs):
        super(SocialAppForm, self).__init__(*args, **kwargs)
        # require the provider_id in the admin, since we can't make it required on allauth's model
        self.fields['provider_id'].required = True


class RequireProviderIdSocialAppAdmin(SocialAppAdmin):
    form = RequireProviderIdSocialAppForm

    class Meta:
        proxy = True


admin.site.unregister(SocialApp)
admin.site.register(SocialApp, RequireProviderIdSocialAppAdmin)
