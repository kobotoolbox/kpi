# coding: utf-8
from django.contrib.auth.views import LoginView
from django.db.models import QuerySet
from django.urls import reverse
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from trench.utils import get_mfa_model

from .forms import (
    MFALoginForm,
    MFATokenForm,
)
from .serializers import UserMFAMethodSerializer


class MFALoginView(LoginView):

    form_class = MFALoginForm

    def form_valid(self, form):
        if form.get_ephemeral_token():
            mfa_token_form = MFATokenForm(initial={
                'ephemeral_token': form.get_ephemeral_token()
            })
            context = self.get_context_data(
                view=MFATokenView, form=mfa_token_form
            )

            return self.response_class(
                request=self.request,
                template='mfa_token.html',
                context=context,
                using=self.template_engine,
            )
        else:
            return super().form_valid(form)

    def get_redirect_url(self):
        """
        Overload parent method to validate `next` url
        """
        redirect_to = super().get_redirect_url()
        # We do not want to redirect a regular user to `/admin/` whether they
        # are not a superuser. Otherwise, they are successfully authenticated,
        # redirected to the admin platform, then disconnected because of the
        # lack of permissions.

        user = self.request.user
        if (
            user.is_authenticated
            and self.redirect_field_name in self.request.POST
            and not user.is_superuser
            and redirect_to.startswith(reverse('admin:index'))
        ):
            return ''

        return redirect_to


class MFATokenView(LoginView):

    """
    Display the login form and handle the login action.
    """
    form_class = MFATokenForm
    authentication_form = None
    template_name = 'mfa_token.html'
    redirect_authenticated_user = False
    extra_context = None


class MFAListUserMethodsView(ListAPIView):
    """
    Display user's methods with dates
    """
    serializer_class = UserMFAMethodSerializer
    permission_classes = (IsAuthenticated,)
    pagination_class = None

    def get_queryset(self) -> QuerySet:
        mfa_model = get_mfa_model()
        return mfa_model.objects.filter(
            user_id=self.request.user.id
        )
