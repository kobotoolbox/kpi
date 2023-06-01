from django.forms import ModelForm, ValidationError

from kpi.deployment_backends.kc_access.shadow_models import KobocatFormDisclaimer
from .models import FormDisclaimer


class FormDisclaimerForm(ModelForm):

    class Meta:
        model = FormDisclaimer
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['message'].required = True

    def clean_default(self):
        default = self.cleaned_data['default']
        if (
            not default
            and not FormDisclaimer.objects.filter(default=True).exists()
        ):
            raise ValidationError(
                'You need to use at least one language as default', 'no_default_error'
            )

        return default

    def clean(self):
        cleaned_data = super().clean()
        default = cleaned_data.get('default', False)
        language = cleaned_data['language']

        if (
            default
            and FormDisclaimer.objects.exclude(pk=self.instance.pk).exists()
        ):
            FormDisclaimer.objects.filter(default=True).update(default=False)
            KobocatFormDisclaimer.objects.filter(default=True).update(default=False)

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
