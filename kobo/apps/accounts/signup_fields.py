import constance
from django import forms
from django.utils.safestring import mark_safe
from django.utils.translation import gettext
from django.utils.translation import gettext_lazy as t

from kobo.static_lists import USER_METADATA_DEFAULT_LABELS

# Only these fields can be controlled by constance.config.USER_METADATA_FIELDS
CONFIGURABLE_METADATA_FIELDS = (
    'name',
    'organization',
    'organization_type',
    'organization_website',
    'gender',
    'sector',
    'country',
    'newsletter_subscription',
)

# Everything a signup form can ask for beyond username, email and password.
# The HTML and SSO forms can ask for all of them, but the headless API
# form only asks for newsletter_subscription and terms_of_service
SIGNUP_EXTRA_FIELD_NAMES = CONFIGURABLE_METADATA_FIELDS + ('terms_of_service',)


def apply_user_metadata_config(form, field_names):
    """
    Remove or require `field_names` according to `USER_METADATA_FIELDS`, so each
    server gets the signup fields its administrator asked for
    """
    from hub.utils.i18n import I18nUtils

    desired_metadata_fields = {
        field['name']: field for field in I18nUtils.get_metadata_fields('user')
    }
    for field_name in field_names:
        if field_name not in form.fields:
            continue

        try:
            desired_field = desired_metadata_fields[field_name]
        except KeyError:
            # This field is unwanted
            form.fields.pop(field_name)
            continue

        field = form.fields[field_name]
        # Part of 'skip logic' for organization fields
        #     The 'Organization Type' dropdown hides 'Organization' and
        # 'Organization Website' inputs if the user has selected
        # 'I am not associated with an organization'. In that case the
        # back end accepts omitted or blank values for organization and
        # organization_website, even if they're 'required'.
        #     Adding errors is easier than removing errors we don't want.
        # So make these fields 'not required', remember we did, and add
        # 'required' errors in the clean() function.
        if (
            desired_metadata_fields.get('organization_type')
            and desired_field.get('required')
            and field_name in ['organization', 'organization_website']
        ):
            # Potentially 'skippable' organization-related field
            field.required = False
            # Add a [data-required] attribute, used by
            #   1. JS to replicate the 'required' appearance, and
            #   2. clean() to remember these are conditionally required
            field.widget.attrs.update({'data-required': True})
        else:
            # Any other field, require based on metadata
            field.required = desired_field.get('required', False)
        field.label = desired_field['label']


def validate_email_domain(email, allow_managed_domains=False):
    """
    Apply KoboToolbox's email domain rules, raising ValidationError on rejection.
    Shared so the HTML form and the API enforce the same policy.
    """
    from .models import SocialAppManagedDomain

    domain = email.split('@')[1].lower()

    if not allow_managed_domains:
        managed = SocialAppManagedDomain.objects.filter(
            domain__iexact=domain, social_app__managed=True
        ).exists()
        if managed:
            raise forms.ValidationError(
                t(
                    'Your organization has restricted the use of passwords. '
                    'Please sign up using SSO instead.'
                )
            )

    blacklist_domains = constance.config.REGISTRATION_BLACKLIST_EMAIL_DOMAINS
    blacklist_domain_set = {
        d.strip().lower() for d in blacklist_domains.splitlines() if d.strip()
    }
    if domain.strip().lower() in blacklist_domain_set:
        raise forms.ValidationError(
            constance.config.REGISTRATION_BLACKLIST_ERROR_MESSAGE
        )

    allowed_domains = constance.config.REGISTRATION_ALLOWED_EMAIL_DOMAINS.strip()
    allowed_domain_list = [d.lower() for d in allowed_domains.split('\n')]
    # An empty domain list means all domains are allowed
    if domain in allowed_domain_list or not allowed_domains:
        return email

    raise forms.ValidationError(
        constance.config.REGISTRATION_DOMAIN_NOT_ALLOWED_ERROR_MESSAGE
    )


class SignupExtraFieldsForm(forms.Form):
    """
    The signup fields that must be collected while the account is created

    allauth injects this as a base class of every signup form - the HTML page,
    the SSO page and the headless API - via `ACCOUNT_SIGNUP_FORM_CLASS`, and
    reads it when publishing the OpenAPI schema. The rest of the profile
    metadata is gathered after login through `PATCH /me/`, so it lives on
    `KoboSignupMixin` instead.

    It sits in its own module because allauth resolves
    `ACCOUNT_SIGNUP_FORM_CLASS` while `allauth.account.forms` is still being
    imported, so it cannot live in `forms.py`, which imports from there
    """

    # NOTE: Fields that are not part of django's contrib.auth.User model
    #       are saved to ExtraUserDetail, via django-allauth internals
    # SEE:
    #     - AccountAdapter (save_user) in kobo/apps/accounts/adapter.py
    #     - https://docs.allauth.org/en/latest/account/advanced.html#creating-and-populating-user-instances    # noqa
    newsletter_subscription = forms.BooleanField(
        label=USER_METADATA_DEFAULT_LABELS['newsletter_subscription'],
        required=False,
    )
    terms_of_service = forms.BooleanField(
        # Label is dynamic, and so is requiredness: servers without a
        # `terms_of_service` sitewide message drop the field entirely, so the
        # published schema must not advertise it as always required. The
        # constructor requires it on servers that do have one.
        required=False,
    )

    def signup(self, request, user):
        """
        allauth requires this method to exist. Nothing to do here: the fields are
        saved by `AccountAdapter.save_user`.
        """
        pass

    def __init__(self, *args, **kwargs):
        from hub.models.sitewide_message import SitewideMessage

        super().__init__(*args, **kwargs)

        # Set dynamic label for terms of service checkbox
        if constance.config.TERMS_OF_SERVICE_URL:
            terms_of_service_link = (
                f'<a href="{constance.config.TERMS_OF_SERVICE_URL}"'
                f' target="_blank">{t("Terms of Service")}</a>'
            )
        else:
            terms_of_service_link = gettext('Terms of Service')
        if constance.config.PRIVACY_POLICY_URL:
            privacy_policy_link = (
                f'<a href="{constance.config.PRIVACY_POLICY_URL}"'
                f' target="_blank">{t("Privacy Policy")}</a>'
            )
        else:
            privacy_policy_link = gettext('Privacy Policy')
        self.fields['terms_of_service'].label = mark_safe(
            t('I agree with the ##terms_of_service## and ##privacy_policy##')
            .replace('##terms_of_service##', terms_of_service_link)
            .replace('##privacy_policy##', privacy_policy_link)
        )

        apply_user_metadata_config(self, ['newsletter_subscription'])

        if SitewideMessage.objects.filter(slug='terms_of_service').exists():
            self.fields['terms_of_service'].required = True
        else:
            self.fields.pop('terms_of_service')

    def clean(self):
        """
        Only runs on the headless API. `KoboSignupMixin.clean()` sits above
        allauth's classes on the HTML and SSO forms and skips this method, so
        these checks cannot run twice there.
        """
        from allauth.account.adapter import get_adapter
        from django.contrib.auth import get_user_model

        cleaned_data = super().clean()

        email = self.cleaned_data.get('email')
        if email and '@' in email:
            try:
                validate_email_domain(email)
            except forms.ValidationError as e:
                self.add_error('email', e)

        # allauth validates the password without a user, so attribute-similarity
        # rules never fire. Repeat the check with a stand-in user, as
        # `SignupForm.clean()` does for the HTML page.
        password = self.cleaned_data.get('password')
        if password:
            dummy_user = get_user_model()()
            dummy_user.username = self.cleaned_data.get('username', '')
            dummy_user.email = email or ''
            try:
                get_adapter().clean_password(password, user=dummy_user)
            except forms.ValidationError as e:
                self.add_error('password', e)

        return cleaned_data
