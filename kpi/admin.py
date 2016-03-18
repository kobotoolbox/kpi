from django.contrib import admin
from hub.models import FormBuilderPreference, SitewideMessage, ExtraUserDetail
from .models import AuthorizedApplication

# Register your models here.
admin.site.register(AuthorizedApplication)
admin.site.register(FormBuilderPreference)
admin.site.register(SitewideMessage)
admin.site.register(ExtraUserDetail)
