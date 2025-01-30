from allauth.account.models import EmailAddress
from allauth.socialaccount.admin import SocialAppForm, SocialAppAdmin
from allauth.socialaccount.models import SocialApp
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db.models import Q

from .models import EmailAddressAdmin, SocialAppCustomData
from kobo.apps.accounts.models import EmailContent


class EmailContentView(admin.ModelAdmin):
    list_display = ('email_name', 'section_name')


admin.site.register(EmailContent, EmailContentView)
admin.site.unregister(EmailAddress)
admin.site.register(EmailAddress, EmailAddressAdmin)


class RequireProviderIdSocialAppForm(SocialAppForm):
    def __init__(self, *args, **kwargs):
        super(SocialAppForm, self).__init__(*args, **kwargs)
        # require the provider_id in the admin, since we can't make it required on allauth's model
        self.fields['provider_id'].required = True

    def clean_provider_id(self):
        reserved_keywords = ['kobo']
        provider_id = self.cleaned_data.get('provider_id')
        """
        Don't allow `kobo` to be set as the `provider_id` value in `SOCIALACCOUNT_PROVIDERS`
        settings because it breaks the login page redirect when language is changed.
        """
        if provider_id in reserved_keywords:
            raise ValidationError(
                f'`{provider_id}` is not a valid value for the `provider_id` setting.'
            )

        """
        By default, django-allauth only supports showing one provider on the login screen.
        But OIDC providers allow multiple subproviders, so kpi has some additional code to display multiple providers.
        Because of that, we need to make sure that the `provider` and `provider_id` fields are unique.
        django-allauth (as of 0.57.0) technically enforces this on the model level, but in practice it's flawed.
        """
        if SocialApp.objects.filter(
            Q(provider_id=provider_id) |
            Q(provider=provider_id)
        ).exclude(pk=self.instance.pk).exists():
            raise ValidationError(
                """The Provider ID value must be unique and cannot match an existing Provider name.
                Please use a different value."""
            )
        return provider_id


class RequireProviderIdSocialAppAdmin(SocialAppAdmin):
    form = RequireProviderIdSocialAppForm

    class Meta:
        proxy = True


admin.site.unregister(SocialApp)
admin.site.register(SocialApp, RequireProviderIdSocialAppAdmin)

admin.site.register(SocialAppCustomData)
