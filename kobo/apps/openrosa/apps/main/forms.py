# coding: utf-8
from django import forms
from django.forms import ModelForm
from django.utils.translation import gettext_lazy as t

from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.libs.utils.logger_tools import publish_xls_form


class UserProfileForm(ModelForm):
    class Meta:
        model = UserProfile
        # Include only `require_auth` since others are now stored in KPI
        fields = ('require_auth',)


class MediaForm(forms.Form):
    media = forms.FileField(label=t('Media upload'), required=True)

    def clean_media(self):
        data_type = self.cleaned_data['media'].content_type
        if data_type not in ['image/jpeg', 'image/png', 'audio/mpeg']:
            raise forms.ValidationError('Only these media types are \
                                        allowed .png .jpg .mp3 .3gp .wav')


class QuickConverterForm(forms.Form):

    xls_file = forms.FileField(
        label=t('XLS File'),
        required=True
    )

    def publish(self, user, id_string=None):
        if self.is_valid():
            cleaned_xls_file = self.cleaned_data['xls_file']

            # publish the xls
            return publish_xls_form(cleaned_xls_file, user, id_string)
