from django import forms
from django.utils.translation import gettext_lazy as _

from kpi.models import ExtraProjectMetadataField, ExtraProjectMetadataFieldType


class ExtraProjectMetadataFieldForm(forms.ModelForm):
    options_raw = forms.CharField(
        widget=forms.Textarea(
            attrs={'rows': 10, 'placeholder': 'ID | Label (e.g., CA | Canada)'}
        ),
        required=False,
        help_text=_('Enter one option per line in the format: Value | Label'),
    )

    class Meta:
        model = ExtraProjectMetadataField
        fields = '__all__'
        widgets = {
            'options': forms.HiddenInput(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'options' in self.fields:
            self.fields['options'].required = False

        if self.instance.pk and self.instance.options:
            lines = [
                f"{opt['name']} | {opt['label'].get('default', '')}"
                for opt in self.instance.options
            ]
            self.initial['options_raw'] = '\n'.join(lines)

    def clean(self):
        cleaned_data = super().clean()
        field_type = cleaned_data.get('type')
        options_raw = cleaned_data.get('options_raw')

        json_options = []
        if options_raw:
            for line in options_raw.splitlines():
                if '|' in line:
                    val, label = line.split('|', 1)
                    json_options.append(
                        {'name': val.strip(), 'label': {'default': label.strip()}}
                    )

        if field_type in [
            ExtraProjectMetadataFieldType.SINGLE_SELECT,
            ExtraProjectMetadataFieldType.MULTI_SELECT,
        ]:
            if not json_options:
                raise forms.ValidationError(
                    _('Select fields require at least one option.')
                )

        cleaned_data['options'] = json_options
        return cleaned_data

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.options = self.cleaned_data['options']
        if commit:
            instance.save()
        return instance
