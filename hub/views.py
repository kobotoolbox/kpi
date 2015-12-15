from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import FormBuilderPreference
from django.http import HttpResponseRedirect

@api_view(['GET'])
def switch_builder(request):
    '''
    very un-restful, but for ease of testing, a quick 'GET' is hard to beat
    '''
    if not request.user.is_authenticated():
        raise exceptions.NotAuthenticated()
    (pref, created) = FormBuilderPreference.objects.get_or_create(user=request.user)
    if pref.preferred_builder == 'K':
        pref.preferred_builder = 'D'
    else:
        pref.preferred_builder = 'K'
    pref.save()

    return HttpResponseRedirect('/')
