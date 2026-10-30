# coding: utf-8

from django.forms import ModelForm

from .models import InAppMessage


class InAppMessageForm(ModelForm):

    class Meta:
        model = InAppMessage
        exclude = ['generic_related_objects']
