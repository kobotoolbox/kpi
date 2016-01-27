from .models import FormBuilderPreference
from django.http import HttpResponseRedirect
from django.core.management import call_command
from django.contrib.auth.decorators import login_required


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
        call_command(
            'import_survey_drafts_from_dkobo',
            username=request.user.username,
            quiet=True # squelches `print` statements
        )

    return HttpResponseRedirect('/')
