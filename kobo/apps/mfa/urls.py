# coding: utf-8
from django.urls import path, include

from .views import MFAListUserMethodsView

urlpatterns = [
    path('mfa/user-methods/', MFAListUserMethodsView.as_view(),
         name='mfa_list_user_methods'),
    path('', include('trench.urls')),
]
