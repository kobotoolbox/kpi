import constance
from allauth.account import app_settings
from allauth.account.adapter import get_adapter
from allauth.account.forms import LoginForm as BaseLoginForm
from allauth.account.forms import SignupForm as BaseSignupForm
from allauth.account.utils import (
    get_user_model,
    user_email,
    user_username,
)
from allauth.socialaccount.forms import SignupForm as BaseSocialSignupForm
from django import forms
from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils.safestring import mark_safe
from django.utils.translation import gettext, gettext_lazy as t

from hub.models.sitewide_message import SitewideMessage
from hub.utils.i18n import I18nUtils
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


class LoginForm(BaseLoginForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['login'].widget.attrs['placeholder'] = ''
        self.fields['password'].widget.attrs['placeholder'] = ''
        self.label_suffix = ''


class KoboSignupMixin(forms.Form):
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
    organization_website.widget.attrs['title'] = t(
        'Please enter a valid URL'
    )

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
        # Label is dynamic; see constructor
        required=True,
    )

    def __init__(self, *args, **kwargs):
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
            .replace("##terms_of_service##", terms_of_service_link)
            .replace("##privacy_policy##", privacy_policy_link)
        )

        # Remove upstream placeholders
        for field_name in ['username', 'email', 'password1', 'password2']:
            if field_name in self.fields:
                self.fields[field_name].widget.attrs['placeholder'] = ''
        if 'password1' in self.fields:
            # Remove `help_text` on purpose since some guidance is provided by
            # Constance setting. Moreover it is redundant with error messages.
            self.fields['password1'].help_text = ''
        if 'password2' in self.fields:
            self.fields['password2'].label = t('Password confirmation')
        if 'email' in self.fields:
            self.fields['email'].widget.attrs['placeholder'] = t('name@organization.org')

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
        if not SitewideMessage.objects.filter(slug='terms_of_service').exists():
            self.fields.pop('terms_of_service')

    def clean(self):
        """
        Override parent form to pass extra user's attributes to validation.
        """
        super(forms.Form, self).clean()

        # Part of 'skip logic' for organization fields.
        # Add 'Field is required' errors for organization and organization_website,
        # since we un-required them in case 'organization_type' is 'none'.
        if 'organization_type' in self.fields:
            for field_name in ['organization', 'organization_website']:
                if (
                    field_name in self.fields
                    and self.fields[field_name].widget.attrs.get(
                        'data-required'
                    )
                    and self.cleaned_data.get('organization_type') != 'none'
                ):
                    if not self.cleaned_data.get(field_name):
                        self.add_error(field_name, t('This field is required.'))

        return self.cleaned_data


    def clean_email(self):
        email = self.cleaned_data['email']
        domain = email.split('@')[1].lower()
        allowed_domains = (
            constance.config.REGISTRATION_ALLOWED_EMAIL_DOMAINS.strip()
        )
        allowed_domain_list = [
            domain.lower() for domain in allowed_domains.split('\n')
        ]
        # An empty domain list means all domains are allowed
        if domain in allowed_domain_list or not allowed_domains:
            return email
        else:
            raise forms.ValidationError(
                constance.config.REGISTRATION_DOMAIN_NOT_ALLOWED_ERROR_MESSAGE
            )


class SocialSignupForm(KoboSignupMixin, BaseSocialSignupForm):
    field_order = [
        'username',
        'email',
        'name',
        'country',
        'sector',
        'organization_type',
        'organization',
        'organization_website',
        'gender',
        'newsletter_subscription',
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if settings.UNSAFE_SSO_REGISTRATION_EMAIL_DISABLE:
            self.fields['email'].widget.attrs['readonly'] = True
        self.label_suffix = ''


class SignupForm(KoboSignupMixin, BaseSignupForm):
    field_order = [
        'name',
        'username',
        'email',
        'country',
        'sector',
        'organization_type',
        'organization',
        'organization_website',
        'gender',
        'newsletter_subscription',
    ]

    def clean(self):
        """
        Override parent form to pass extra user's attributes to validation.
        """
        super(SignupForm, self).clean()

        User = get_user_model()  # noqa

        dummy_user = User()
        # Using `dummy_user`, a temporary User object, to assign attributes that are
        # validated during the password similarity check.
        user_username(dummy_user, self.cleaned_data.get('username'))
        user_email(dummy_user, self.cleaned_data.get('email'))
        setattr(
            dummy_user,
            'organization_name',
            self.cleaned_data.get('organization', ''),
        )
        setattr(dummy_user, 'full_name', self.cleaned_data.get('name', ''))

        password = self.cleaned_data.get('password1')
        if password:
            try:
                get_adapter().clean_password(password, user=dummy_user)
            except forms.ValidationError as e:
                self.add_error('password1', e)

        if (
            app_settings.SIGNUP_PASSWORD_ENTER_TWICE
            and 'password1' in self.cleaned_data
            and 'password2' in self.cleaned_data
        ):
            if self.cleaned_data['password1'] != self.cleaned_data['password2']:
                self.add_error(
                    'password2',
                    t('You must type the same password each time.'),
                )

        return self.cleaned_data
