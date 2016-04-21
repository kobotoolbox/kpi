from django.contrib.auth.decorators import login_required
from django.core.management import call_command
from django.db import transaction
from django.http import HttpResponseRedirect
from registration.backends.default.views import RegistrationView
from registration.forms import RegistrationForm

from kpi.tasks import sync_kobocat_xforms
from .models import FormBuilderPreference, ExtraUserDetail


@login_required
def switch_builder(request):
    '''
    very un-restful, but for ease of testing, a quick 'GET' is hard to beat
    '''
    if 'beta' in request.GET:
        beta_val = request.GET.get('beta') == '1'
        (pref, created) = FormBuilderPreference.objects.get_or_create(
            user=request.user)
        pref.preferred_builder = FormBuilderPreference.KPI if beta_val \
            else FormBuilderPreference.DKOBO
        pref.save()
    if 'migrate' in request.GET:
        # TODO: don't start these tasks for if they're already running for this
        # particular user
        call_command(
            'import_survey_drafts_from_dkobo',
            username=request.user.username,
            quiet=True # squelches `print` statements
        )
        # Create/update KPI assets to match the user's KC forms
        sync_kobocat_xforms(username=request.user.username)

    return HttpResponseRedirect('/')


class ExtraDetailRegistrationView(RegistrationView):
    def register(self, request, form, *args, **kwargs):
        ''' Save all the fields not included in the standard `RegistrationForm`
        into the JSON `data` field of an `ExtraUserDetail` object '''
        standard_fields = set(RegistrationForm().fields.keys())
        extra_fields = set(form.fields.keys()).difference(standard_fields)
        # Don't save the user unless we successfully store the extra data
        with transaction.atomic():
            new_user = super(ExtraDetailRegistrationView, self).register(
                request, form, *args, **kwargs)
            extra_data = {k: form.cleaned_data[k] for k in extra_fields}
            new_user.extra_details.data.update(extra_data)
            new_user.extra_details.save()
        return new_user
