from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.forms import SignupForm
from constance import config
from django.conf import settings
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.contrib.sites.shortcuts import get_current_site
from django.db import transaction
from django.shortcuts import resolve_url
from django.template.response import TemplateResponse
from trench.utils import get_mfa_model, user_token_generator

from .mfa.forms import MfaTokenForm
from .mfa.views import MfaTokenView


class AccountAdapter(DefaultAccountAdapter):

    def pre_login(self, request, user, **kwargs):

        auth_method = (
            get_mfa_model()
            .objects.filter(is_active=True, user=user)
            .first()
        )
        if auth_method:
            ephemeral_token_cache = user_token_generator.make_token(user)
            mfa_token_form = MfaTokenForm(
                initial={'ephemeral_token': ephemeral_token_cache}
            )
            current_site = get_current_site(request)
            context = {
                REDIRECT_FIELD_NAME: resolve_url(settings.LOGIN_REDIRECT_URL),
                'site': current_site,
                'site_name': current_site.name,
                'view': MfaTokenView,
                'form': mfa_token_form,
            }

            return TemplateResponse(
                request=request,
                template='mfa_token.html',
                context=context,
            )

        return super().pre_login(request, user, **kwargs)

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
