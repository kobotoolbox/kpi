from django import forms

from allauth.account.forms import LoginForm as BaseLoginForm
from allauth.account.forms import PasswordField


class LoginForm(BaseLoginForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["login"].widget.attrs["placeholder"] = ""
        self.fields["password"].widget.attrs["placeholder"] = ""
