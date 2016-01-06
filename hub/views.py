from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import FormBuilderPreference
from django.http import HttpResponseRedirect
from django.core.management import call_command


@api_view(['GET'])
def switch_builder(request):
    '''
    very un-restful, but for ease of testing, a quick 'GET' is hard to beat
    '''
    if not request.user.is_authenticated():
        raise exceptions.NotAuthenticated()

    if 'beta' in request.GET:
        beta_val = request.GET.get('beta') == '1'
        (pref, created) = FormBuilderPreference.objects.get_or_create(
            user=request.user)
        pref.preferred_builder = FormBuilderPreference.KPI if beta_val \
            else FormBuilderPreference.DKOBO
        pref.save()
    if 'migrate' in request.GET:
        call_command(
            'import_survey_drafts_from_dkobo', username=request.user.username)

    return HttpResponseRedirect('/')
