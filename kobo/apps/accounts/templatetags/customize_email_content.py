from django import template

from kobo.apps.accounts.models import EmailContent

register = template.Library()


@register.filter
def email_template(email_name):
    """
    Fetch the email template from the database and organize the contents into a
    dict
    Ex.
    {
        "section": "This is some section content",
    }
    """
    email_contents = EmailContent.objects.values(
        'section_name', 'content'
    ).filter(email_name=email_name)
    email_content_dict = {}
    for email_content in email_contents:
        email_content_dict[email_content['section_name']] = email_content['content']
    return email_content_dict


@register.simple_tag
def convert_placeholders(section_content, activate_url, user):
    """
    Coverts placeholders into desired content

    Supported placeholders:
    ##activate_url##
    ##user##
    """
    return section_content.replace(
        '##activate_url##', activate_url
    ).replace('##user##', user.username).replace("&#x27;", "\'")

