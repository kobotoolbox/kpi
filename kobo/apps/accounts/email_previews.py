"""
Browser previews of the account confirmation emails

Storybook has no Django renderer, so this is the nearest equivalent: every
variant worth a look, rendered through the same adapter that sends the real
thing. `tests/test_email_templates.py` asserts against the same table and
helpers, so the previews cannot quietly drift from what is tested.

Only the view is development-only; see `kpi/urls/__init__.py`.
"""

from dataclasses import dataclass, field

from allauth.account.adapter import get_adapter
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import Http404, HttpResponse
from django.template.response import TemplateResponse
from django.views.decorators.clickjacking import xframe_options_sameorigin

from .models import EmailContent

# Shaped like a real confirmation link, so the button and the plain-text body
# are as wide as they will be in production
ACTIVATE_URL = (
    'https://kf.example.org/accounts/confirm-email/'
    'MjM6MXVOUlJNOkpXUV9yZEVIa0JmcVYxUm9/'
)

PREVIEW_USERNAME = 'kobo_user'

# The prefixes `AccountAdapter.get_confirmation_email_template()` chooses between
SIGNUP = 'account/email/email_confirmation_signup'
RESEND = 'account/email/email_confirmation_resend'
EMAIL_CHANGE = 'account/email/email_confirmation'


@dataclass(frozen=True)
class EmailPreview:
    """One entry in the preview sidebar"""

    slug: str
    label: str
    template_prefix: str
    # Blank matches a real signup: nothing fills in `first_name`, so the
    # greeting falls back to the username
    first_name: str = ''
    # `EmailContent` sections, as an instance admin would set them in Django
    # admin. Applied and rolled back; see `render_preview()`
    email_content: dict = field(default_factory=dict)


PREVIEWS = (
    EmailPreview('signup', 'Activate account', SIGNUP),
    EmailPreview('resend', 'Activate account (resent)', RESEND),
    EmailPreview('email-change', 'Verify email address', EMAIL_CHANGE),
    EmailPreview(
        'signup-named',
        'Activate account (user has a first name)',
        SIGNUP,
        first_name='Ana',
    ),
    EmailPreview(
        'signup-customized',
        'Activate account (admin-customized)',
        SIGNUP,
        email_content={
            EmailContent.SectionOptions.SUBJECT: (
                'Activate your Example Org account'
            ),
            EmailContent.SectionOptions.SECTION_ONE: (
                'Hi ##user##,\n\n'
                'Activate your Example Org account by following this link:\n'
                '##activate_url##'
            ),
            EmailContent.SectionOptions.SECTION_TWO: (
                'Any questions? Write to support@example.org.'
            ),
        },
    ),
)

def render_email(template_prefix, user, activate_url=ACTIVATE_URL):
    """Build the message allauth would send, with its own rendering"""
    return get_adapter().render_mail(
        template_prefix,
        user.email,
        {'user': user, 'activate_url': activate_url, 'key': 'TOKEN'},
    )


def html_body(message):
    """The `text/html` alternative allauth attached next to the plain-text body"""
    bodies = [
        content for content, mimetype in message.alternatives if mimetype == 'text/html'
    ]
    assert len(bodies) == 1, 'expected exactly one HTML alternative'
    return bodies[0]


def render_preview(preview):
    """
    Render one sidebar entry

    The signup templates read their overridable sections from the database, so
    every variant renders inside a transaction that replaces those rows and is
    then rolled back. That keeps previews identical on an instance that has
    customizations of its own, and leaves those customizations alone.
    """
    user = get_user_model()(
        username=PREVIEW_USERNAME,
        first_name=preview.first_name,
        email='user@example.org',
    )
    with transaction.atomic():
        EmailContent.objects.filter(
            email_name=EmailContent.EmailOptions.ACTIVATION_EMAIL
        ).delete()
        EmailContent.objects.bulk_create(
            EmailContent(
                email_name=EmailContent.EmailOptions.ACTIVATION_EMAIL,
                section_name=section_name,
                content=content,
            )
            for section_name, content in preview.email_content.items()
        )
        message = render_email(preview.template_prefix, user)
        transaction.set_rollback(True)
    return message


def _get_preview(slug):
    for preview in PREVIEWS:
        if preview.slug == slug:
            return preview
    raise Http404(f'No email preview named "{slug}"')


def dev_email_preview(request, slug=PREVIEWS[0].slug):
    """
    List the confirmation emails and show one of them

    Django reloads templates per request while `DEBUG` is on, so edit a template
    and refresh. Narrow widths and dark mode have no toggles: resize the window
    and use the browser's appearance setting, as the email reacts to both on its
    own.
    """
    preview = _get_preview(slug)
    return TemplateResponse(
        request,
        'dev/email_preview.html',
        {
            'previews': PREVIEWS,
            'preview': preview,
            'subject': render_preview(preview).subject,
            'part': 'text' if request.GET.get('part') == 'text' else 'html',
        },
    )


@xframe_options_sameorigin
def dev_email_preview_raw(request, slug):
    """
    One email on its own, for the preview page's iframe to load

    `X_FRAME_OPTIONS` defaults to `DENY`, so the iframe needs an exemption;
    same-origin is enough.
    """
    message = render_preview(_get_preview(slug))
    if request.GET.get('part') == 'text':
        return HttpResponse(message.body, content_type='text/plain; charset=utf-8')
    return HttpResponse(html_body(message))
