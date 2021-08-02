# coding: utf-8
import os

from django.urls import reverse
from markdownx.forms import ImageForm

from .models import InAppMessageFile


class InAppMessageImageForm(ImageForm):
    """
    This custom upload form for django-markdownx allows us to return
    an image URL that points at `views.InAppMessageFileContentView`
    """
    def save(self, commit=True):
        if not commit:
            return super().save(commit=False)
        image_data = super().save(commit=False)
        image_object = InAppMessageFile()
        image_object.content.save(
            os.path.split(image_data.path)[1], image_data.image
        )
        image_object.save()
        return reverse(
            'in-app-message-file-contents', args=(image_object.content.name,)
        )
