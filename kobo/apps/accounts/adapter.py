from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.forms import SignupForm
from constance import config
from django.conf import settings
from django.contrib.auth import REDIRECT_FIELD_NAME, login
from django.db import transaction
from django.shortcuts import resolve_url
from django.urls import reverse
from django.template.response import TemplateResponse
from django.utils import timezone
from trench.utils import get_mfa_model, user_token_generator

from .constants import (
    ACCOUNT_TYPE_ORGANIZATIONAL,
    ACCOUNT_TYPE_PERSONAL,
    PAYMENT_STATUS_CONFIRMED,
    PAYMENT_STATUS_NOT_REQUIRED,
    PAYMENT_STATUS_PENDING,
    PERSONAL_ALLOWED_MODULES,
    PERSONAL_STORAGE_LIMIT_MB,
)
from .mfa.forms import MfaTokenForm
from .mfa.models import MfaAvailableToUser
from .mfa.permissions import mfa_allowed_for_user
from .mfa.views import MfaTokenView
from .utils import user_has_inactive_paid_subscription


class AccountAdapter(DefaultAccountAdapter):

    def is_open_for_signup(self, request):
        return config.REGISTRATION_OPEN

    def login(self, request, user):
        # Override django-allauth login method to use specified authentication backend
        user.backend = settings.AUTHENTICATION_BACKENDS[0]
        super().login(request, user)

    def pre_login(self, request, user, **kwargs):

        if parent_response := super().pre_login(request, user, **kwargs):
            # A response from the parent means the login process must be
            # interrupted, e.g. due to the user being inactive or not having
            # validated their email address
            return parent_response

        # If MFA is activated and allowed for the user, display the token form before letting them in
        mfa_active = (
            get_mfa_model().objects.filter(is_active=True, user=user).exists()
        )
        mfa_allowed = mfa_allowed_for_user(user)
        inactive_subscription = user_has_inactive_paid_subscription(
            user.username
        )
        if mfa_active and (mfa_allowed or inactive_subscription):
            ephemeral_token_cache = user_token_generator.make_token(user)
            mfa_token_form = MfaTokenForm(
                initial={'ephemeral_token': ephemeral_token_cache}
            )

            next_url = kwargs.get('redirect_url') or resolve_url(
                settings.LOGIN_REDIRECT_URL
            )

            context = {
                REDIRECT_FIELD_NAME: next_url,
                'view': MfaTokenView,
                'form': mfa_token_form,
            }

            return TemplateResponse(
                request=request,
                template='mfa_token.html',
                context=context,
            )

    def save_user(self, request, user, form, commit=True):
        # Compare allauth SignupForm with our custom field
        standard_fields = set(SignupForm().fields.keys())
        extra_fields = set(form.fields.keys()).difference(standard_fields)
        with transaction.atomic():
            user = super().save_user(request, user, form, commit)
            extra_data = {k: form.cleaned_data[k] for k in extra_fields}

            # If the form contains a Terms of Service checkbox (checked)
            if extra_data.pop('terms_of_service', None):
                # We 'pop' because we don't want to save 'terms_of_service':true
                # in extra_details.data. Instead, save a now() date string as
                # the last ToS acceptance time in private_data.
                # See also: TOSView.post() in apps/accounts/tos.py, which
                # lets the frontend accept ToS on behalf of existing users.
                user.extra_details.private_data['last_tos_accept_time'] = (
                    timezone.now().strftime('%Y-%m-%dT%H:%M:%SZ')
                )

            user.extra_details.data.update(extra_data)
            details_data = user.extra_details.data
            account_type = details_data.get(
                'account_type', ACCOUNT_TYPE_PERSONAL
            )

            if account_type == ACCOUNT_TYPE_ORGANIZATIONAL:
                if details_data.get('payment_status') != PAYMENT_STATUS_CONFIRMED:
                    details_data['payment_status'] = PAYMENT_STATUS_PENDING
                    details_data['allowed_modules'] = list(
                        PERSONAL_ALLOWED_MODULES
                    )
                details_data.pop('storage_limit_mb', None)
            else:
                details_data['payment_status'] = PAYMENT_STATUS_NOT_REQUIRED
                details_data['storage_limit_mb'] = PERSONAL_STORAGE_LIMIT_MB
                details_data['allowed_modules'] = list(PERSONAL_ALLOWED_MODULES)
            if commit:
                user.extra_details.save()
        return user

    def get_signup_redirect_url(self, request):
        user = request.user
        if user.is_authenticated:
            try:
                extra_details = user.extra_details
            except user.extra_details.RelatedObjectDoesNotExist:
                pass
            else:
                data = extra_details.data or {}
                if (
                    data.get('account_type') == ACCOUNT_TYPE_ORGANIZATIONAL
                    and data.get('payment_status') == PAYMENT_STATUS_PENDING
                ):
                    return reverse('account_organizational_payment')
        return super().get_signup_redirect_url(request)

    def set_password(self, user, password):
        with transaction.atomic():
            user.extra_details.password_date_changed = timezone.now()
            user.extra_details.validated_password = True
            user.extra_details.save(
                update_fields=['password_date_changed', 'validated_password']
            )
            user.set_password(password)
            user.save()
