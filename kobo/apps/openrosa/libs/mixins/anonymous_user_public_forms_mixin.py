# coding: utf-8
from kobo.apps.openrosa.apps.logger.models.xform import XForm


class AnonymousUserPublicFormsMixin:

    def _get_public_forms_queryset(self):
        return XForm.objects.filter(shared=True)

    def get_queryset(self):
        """Public forms only for anonymous Users."""
        if self.request and self.request.user.is_anonymous:
            return self._get_public_forms_queryset()

        return super().get_queryset()
