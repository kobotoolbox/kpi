# coding: utf-8
import constance
from django.db import transaction
from registration.backends.default.views import RegistrationView
from registration.forms import RegistrationForm


class ExtraDetailRegistrationView(RegistrationView):
    def registration_allowed(self, *args, **kwargs):
        return constance.config.REGISTRATION_OPEN and \
               super().registration_allowed(*args, **kwargs)

    def register(self, form):
        """
        Save all the fields not included in the standard `RegistrationForm`
        into the JSON `data` field of an `ExtraUserDetail` object
        """
        standard_fields = set(RegistrationForm().fields.keys())
        extra_fields = set(form.fields.keys()).difference(standard_fields)
        # Don't save the user unless we successfully store the extra data
        with transaction.atomic():
            new_user = super().register(form)
            extra_data = {k: form.cleaned_data[k] for k in extra_fields}
            new_user.extra_details.data.update(extra_data)
            new_user.extra_details.save()
        return new_user
