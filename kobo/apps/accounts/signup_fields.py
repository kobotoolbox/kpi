import constance
from django import forms
from django.utils.safestring import mark_safe
from django.utils.translation import gettext
from django.utils.translation import gettext_lazy as t

from kobo.static_lists import COUNTRIES, USER_METADATA_DEFAULT_LABELS

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
    # NOTE: Fields that are not part of django's contrib.auth.User model
    #       are saved to ExtraUserDetail, via django-allauth internals
    # SEE:
    #     - AccountAdapter (save_user) in kobo/apps/accounts/adapter.py
    #     - https://docs.allauth.org/en/latest/account/advanced.html#creating-and-populating-user-instances
    name = forms.CharField(
        label=USER_METADATA_DEFAULT_LABELS['name'],
        required=False,
    )
    organization = forms.CharField(
        label=USER_METADATA_DEFAULT_LABELS['organization'],
        required=False,
    )
    organization_website = forms.CharField(
        label=USER_METADATA_DEFAULT_LABELS['organization_website'],
        required=False,
        widget=forms.URLInput,
    )
    organization_website.widget.attrs['pattern'] = (
        # Use r'' so we can copy-paste the literal without escaping backslashes
        r'\s*(https?:\/\/)?([^\s.:\/]+\.)+([^\s.:\/]){2,}(:\d{1,5})?(\/.*)?\s*'
    )
    organization_website.widget.attrs['title'] = t('Please enter a valid URL')

    organization_type = forms.ChoiceField(
        label=USER_METADATA_DEFAULT_LABELS['organization_type'],
        required=False,
        choices=(
            ('', ''),
            ('non-profit', t('Non-profit organization')),
            ('government', t('Government institution')),
            ('educational', t('Educational organization')),
            ('commercial', t('A commercial/for-profit company')),
            ('none', t('I am not associated with any organization')),
        ),
    )
    gender = forms.ChoiceField(
        label=USER_METADATA_DEFAULT_LABELS['gender'],
        required=False,
        widget=forms.RadioSelect,
        choices=(
            ('male', t('Male')),
            ('female', t('Female')),
            ('other', t('Other')),
        ),
    )
    sector = forms.ChoiceField(
        label=USER_METADATA_DEFAULT_LABELS['sector'],
        required=False,
        # Don't set choices here; set them in the constructor so that changes
        # made in the Django admin interface do not require a server restart
    )
    country = forms.ChoiceField(
        label=USER_METADATA_DEFAULT_LABELS['country'],
        required=False,
        choices=(('', ''),) + COUNTRIES,
    )
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
        from hub.utils.i18n import I18nUtils

        super().__init__(*args, **kwargs)
        self.label_suffix = ''

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

        # Intentional t() call on dynamic string because the default choices
        # are translated (see static_lists.py)
        # Strip "\r" for legacy data created prior to django-constance 2.7.
        self.fields['sector'].choices = (('', ''),) + tuple(
            (s.strip('\r'), t(s.strip('\r')))
            for s in constance.config.SECTOR_CHOICES.split('\n')
        )

        # It's easier to _remove_ unwanted fields here in the constructor
        # than to add a new fields *shrug*
        desired_metadata_fields = I18nUtils.get_metadata_fields('user')
        desired_metadata_fields = {
            field['name']: field for field in desired_metadata_fields
        }
        for field_name in list(self.fields.keys()):
            if field_name not in CONFIGURABLE_METADATA_FIELDS:
                # This field is not allowed to be configured
                continue

            try:
                desired_field = desired_metadata_fields[field_name]
            except KeyError:
                # This field is unwanted
                self.fields.pop(field_name)
                continue

            field = self.fields[field_name]
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
            self.fields[field_name].label = desired_field['label']

        if SitewideMessage.objects.filter(slug='terms_of_service').exists():
            self.fields['terms_of_service'].required = True
        else:
            self.fields.pop('terms_of_service')

    def validate_conditionally_required_organization_fields(self):
        """
        Part of 'skip logic' for organization fields. Add 'Field is required'
        errors for organization and organization_website, since we un-required
        them in case 'organization_type' is 'none'.
        """
        if 'organization_type' not in self.fields:
            return

        for field_name in ['organization', 'organization_website']:
            if (
                field_name in self.fields
                and self.fields[field_name].widget.attrs.get('data-required')
                and self.cleaned_data.get('organization_type') != 'none'
            ):
                if not self.cleaned_data.get(field_name):
                    self.add_error(field_name, t('This field is required.'))

    def clean(self):
        """
        Only runs on the headless API. `KoboSignupMixin.clean()` sits above
        allauth's classes on the HTML and SSO forms and skips this method, so
        these checks cannot run twice there.
        """
        from allauth.account.adapter import get_adapter
        from django.contrib.auth import get_user_model

        cleaned_data = super().clean()

        self.validate_conditionally_required_organization_fields()

        email = self.cleaned_data.get('email')
        if email and '@' in email:
            try:
                validate_email_domain(email)
            except forms.ValidationError as e:
                self.add_error('email', e)

        # allauth validates the password without a user, so attribute-similarity
        # rules never fire. Repeat the check with the same stand-in user
        # `SignupForm.clean()` builds for the HTML page.
        password = self.cleaned_data.get('password')
        if password:
            dummy_user = get_user_model()()
            dummy_user.username = self.cleaned_data.get('username', '')
            dummy_user.email = email or ''
            dummy_user.organization_name = self.cleaned_data.get('organization', '')
            dummy_user.full_name = self.cleaned_data.get('name', '')
            try:
                get_adapter().clean_password(password, user=dummy_user)
            except forms.ValidationError as e:
                self.add_error('password', e)

        return cleaned_data
