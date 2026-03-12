from django import forms
from django.utils.translation import gettext_lazy as _

from kpi.models import ExtraProjectMetadataField, ExtraProjectMetadataFieldType


class ExtraProjectMetadataFieldForm(forms.ModelForm):
    class Meta:
        model = ExtraProjectMetadataField
        fields = '__all__'
        widgets = {
            'options': forms.Textarea(attrs={'rows': 10}),
            'label': forms.Textarea(attrs={'rows': 3}),
        }

    def clean_options(self):
        options = self.cleaned_data.get('options')
        field_type = self.cleaned_data.get('type')

        if field_type in [
            ExtraProjectMetadataFieldType.SINGLE_SELECT,
            ExtraProjectMetadataFieldType.MULTI_SELECT,
        ]:
            if not options:
                raise forms.ValidationError(
                    _('Select fields require at least one option in JSON format.')
                )
        return options
