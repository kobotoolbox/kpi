from django import template
from django.utils.translation import gettext_lazy as t

from kobo.apps.accounts.models import EmailContent

register = template.Library()


@register.filter
def email_template(email_name):
    email_contents = EmailContent.objects.values(
        'section_name', 'content'
    ).filter(email_name=email_name)
    email_content_dict = {}
    for email_content in email_contents:
        email_content_dict[email_content['section_name']] = email_content['content']
    return email_content_dict


@register.simple_tag
def get_variables(section_content, activate_url, user):
    return section_content.replace(
        '##activate_url##', activate_url
    ).replace('##user##', user.username)

