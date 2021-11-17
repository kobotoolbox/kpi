# coding: utf-8

from django.contrib.auth.views import LoginView

from kpi.forms.mfa import (
    MFALoginForm,
    MFATokenForm,
)


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
                template='registration/mfa_token.html',
                context=context,
                using=self.template_engine,
            )
        else:
            return super().form_valid(form)


class MFATokenView(LoginView):

    """
    Display the login form and handle the login action.
    """
    form_class = MFATokenForm
    authentication_form = None
    template_name = 'registration/mfa_token.html'
    redirect_authenticated_user = False
    extra_context = None
