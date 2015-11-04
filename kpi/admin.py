from django.contrib import admin
from hub.models import FormBuilderPreference
from .models import AuthorizedApplication

# Register your models here.
admin.site.register(AuthorizedApplication)
admin.site.register(FormBuilderPreference)
