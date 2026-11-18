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


@register.simple_tag(takes_context=True)
def email_sections(context, email_name):
    """
    The `email_template` filter, but reading the database only once per render

    A template needing the sections in more than one block would otherwise
    query for each one. `render_context` lives for exactly one render, so an
    edit in Django admin still shows up in the next email.
    """
    cache_key = f'email_sections:{email_name}'
    if cache_key not in context.render_context:
        context.render_context[cache_key] = email_template(email_name)
    return context.render_context[cache_key]


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

