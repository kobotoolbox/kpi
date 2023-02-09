from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.forms import SignupForm
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from constance import config
from django.db import transaction


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return config.REGISTRATION_OPEN

    def save_user(self, request, user, form, commit=True):
        # Compare allauth SignupForm with our custom field
        standard_fields = set(SignupForm().fields.keys())
        extra_fields = set(form.fields.keys()).difference(standard_fields)
        with transaction.atomic():
            user = super().save_user(request, user, form, commit)
            extra_data = {k: form.cleaned_data[k] for k in extra_fields}
            user.extra_details.data.update(extra_data)
            if commit:
                user.extra_details.save()
        return user


# The following class is a work around for https://github.com/pennersr/django-allauth/issues/3257
# Also see https://github.com/pennersr/django-allauth/issues/3241
# PR fix: https://github.com/pennersr/django-allauth/pull/3242
class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)
        if not user.email and sociallogin.email_addresses:
            user.email = sociallogin.email_addresses[0].email
        return user
