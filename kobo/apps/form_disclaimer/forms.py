from django.forms import ModelForm, ValidationError

from .models import FormDisclaimer


class FormDisclaimerForm(ModelForm):

    class Meta:
        model = FormDisclaimer
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['message'].required = True
        self.fields['language'].required = True

    def clean_default(self):
        default = self.cleaned_data['default']
        if (
            not default
            and not FormDisclaimer.objects.filter(default=True)
            .exclude(pk=self.instance.pk)
            .exists()
        ):
            raise ValidationError(
                'You need to use at least one language as default',
                'no_default_error',
            )

        return default

    def clean(self):
        cleaned_data = super().clean()
        default = cleaned_data.get('default', False)
        language = cleaned_data.get('language', False)

        if (
            default
            and FormDisclaimer.objects.filter(default=True)
            .exclude(pk=self.instance.pk)
            .exists()
        ):
            FormDisclaimer.objects.filter(default=True).update(default=False)

        if (
            FormDisclaimer.objects.filter(language=language, asset__isnull=True)
            .exclude(pk=self.instance.pk)
            .exists()
        ):
            raise ValidationError(
                'Disclaimer for this language is already set',
                'unique_global_message_error',
            )

        return cleaned_data


class OverriddenFormDisclaimerForm(ModelForm):

    class Meta:
        model = FormDisclaimer
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['asset'].required = True
        self.fields['message'].required = False
        self.fields['message'].help_text = 'Custom disclaimer message'
        self.fields['language'].help_text = (
            'Override specific languages for this form'
        )
        self.fields['hidden'].help_text = (

        )

    def clean(self):
        language = self.cleaned_data.get('language', None)
        hidden = self.cleaned_data.get('hidden', False)
        message = self.cleaned_data.get('message', '')
        asset = self.cleaned_data.get('asset', None)

        if not FormDisclaimer.objects.filter(
            asset__isnull=True
        ).exists():
            raise ValidationError(
                'You must set a global disclaimer first.',
                'no_global_disclaimer',
            )

        if not hidden and (not language or not message):
            raise ValidationError(
                'You must specify a language and a message if the disclaimer '
                'is not hidden',
                'empty_language',
            )
        elif hidden:
            # Force language and message to be blank if disclaimer is hidden
            # to get some consistency in DB
            self.cleaned_data['language'] = None
            self.cleaned_data['message'] = ''

            if not self.instance.pk:
                if FormDisclaimer.objects.filter(
                    asset=asset, hidden=True
                ).exists():
                    raise ValidationError(
                        'The disclaimer is already hidden for this asset.',
                        'already_hidden_asset',
                    )

            if FormDisclaimer.objects.filter(
                asset=asset, language__isnull=False
            ).exclude(pk=self.instance.pk).exists():
                raise ValidationError(
                    'The disclaimer for this asset is overridden. '
                    'Please delete the override before hiding it.',
                    'already_translated_disclaimers',
                )
        else:
            if FormDisclaimer.objects.filter(
                asset=asset, hidden=True
            ).exclude(pk=self.instance.pk).exists():
                raise ValidationError(
                    'You cannot override the disclaimer for this asset '
                    'because it is already flagged as hidden.',
                    'already_hidden_asset',
                )

        return self.cleaned_data
