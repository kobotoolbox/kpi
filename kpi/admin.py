from django.contrib import admin
from hub.models import FormBuilderPreference, SitewideMessage
from hub.models import UserRegistrationChoice, ExtraUserDetail
from .models import AuthorizedApplication

# Register your models here.
admin.site.register(AuthorizedApplication)
admin.site.register(FormBuilderPreference)
admin.site.register(SitewideMessage)
admin.site.register(UserRegistrationChoice)
admin.site.register(ExtraUserDetail)
