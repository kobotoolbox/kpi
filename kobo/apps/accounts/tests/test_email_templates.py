from ddt import data, ddt, unpack
from django.conf import settings
from django.test import TestCase
from model_bakery import baker

from kobo.apps.accounts.email_previews import (
    ACTIVATE_URL,
    EMAIL_CHANGE,
    PREVIEWS,
    RESEND,
    SIGNUP,
    html_body,
    render_email,
    render_preview,
)
from kobo.apps.accounts.models import EmailContent

# A phrase unique to each confirmation email's wording
CONFIRMATION_EMAILS = (
    (SIGNUP, 'Welcome to KoboToolbox'),
    (RESEND, 'Since you were unable to use your previous account activation link'),
    (
        EMAIL_CHANGE,
        'To confirm the email address associated with your KoboToolbox account',
    ),
)


@ddt
class ConfirmationEmailTemplateTestCase(TestCase):
    """
    Each confirmation email ships an HTML body alongside its plain-text one

    allauth attaches the HTML purely because a `_message.html` sits next to the
    `_message.txt`; nothing in `AccountAdapter` arranges it. Pinning that down
    turns a lost HTML body into a failure instead of a silent downgrade.
    """

    def setUp(self):
        self.user = baker.make(
            settings.AUTH_USER_MODEL, username='kobo_user', email='user@example.com'
        )

    @data(*CONFIRMATION_EMAILS)
    @unpack
    def test_email_has_both_bodies(self, template_prefix, unique_phrase):
        message = render_email(template_prefix, self.user)

        assert message.subject
        assert unique_phrase in message.body
        assert unique_phrase in html_body(message)

    @data(*CONFIRMATION_EMAILS)
    @unpack
    def test_both_bodies_carry_the_activation_link(self, template_prefix, _phrase):
        message = render_email(template_prefix, self.user)

        assert ACTIVATE_URL in message.body
        assert 'href="%s"' % ACTIVATE_URL in html_body(message)

    @data(*CONFIRMATION_EMAILS)
    @unpack
    def test_html_body_uses_the_shared_chrome(self, template_prefix, _phrase):
        """All three extend `base_message.html`, so all three get its footer"""
        html = html_body(render_email(template_prefix, self.user))

        assert '<!doctype html>' in html
        assert 'KoboToolbox-CleanLogo.png' in html
        assert 'kobotoolbox.org/privacy/' in html

    @data(*CONFIRMATION_EMAILS)
    @unpack
    def test_html_body_escapes_the_username(self, template_prefix, _phrase):
        """
        The greeting falls back to the username, which the account holder chose
        """
        self.user.username = '<script>alert(1)</script>'
        html = html_body(render_email(template_prefix, self.user))

        assert '<script>' not in html
        assert '&lt;script&gt;' in html


class SignupEmailAdminOverrideTestCase(TestCase):
    """
    An instance admin's `EmailContent` edits have to reach the HTML body too

    Most clients show the HTML part, so honouring the override only in the
    plain-text body would look to a self-hosting admin like their customisation
    had stopped working.
    """

    template_prefix = SIGNUP

    def setUp(self):
        self.user = baker.make(
            settings.AUTH_USER_MODEL, username='kobo_user', email='user@example.com'
        )

    def override(self, **sections):
        for section_name, content in sections.items():
            EmailContent.objects.create(
                email_name=EmailContent.EmailOptions.ACTIVATION_EMAIL,
                section_name=section_name,
                content=content,
            )

    def test_custom_sections_replace_the_defaults(self):
        self.override(
            section_one='Activate here: ##activate_url##',
            section_two='Written for ##user##',
        )
        html = html_body(render_email(self.template_prefix, self.user))

        assert 'Activate here:' in html
        assert 'Written for kobo_user' in html
        # The designed defaults step aside entirely; the wording is the admin's
        assert 'Welcome to KoboToolbox, kobo_user!' not in html
        assert 'Activate My Account' not in html
        assert 'Help Center' not in html

    def test_placeholders_become_links_and_paragraphs_survive(self):
        self.override(section_one='First line.\n\nLink: ##activate_url##')
        html = html_body(render_email(self.template_prefix, self.user))

        assert '<p>First line.</p>' in html
        # `urlize` percent-encodes the href but leaves the visible text intact
        assert '>%s</a>' % ACTIVATE_URL in html

    def test_admin_markup_is_escaped(self):
        """Admins edit plain text; treating it as HTML would be an injection"""
        self.override(section_one='<script>alert(1)</script>')
        html = html_body(render_email(self.template_prefix, self.user))

        assert '<script>' not in html
        assert '&lt;script&gt;' in html

    def test_blank_sections_drop_the_text(self):
        """
        A row that exists but is empty means "say nothing here", matching the
        plain-text template's behaviour
        """
        self.override(section_one='', section_two='')
        html = html_body(render_email(self.template_prefix, self.user))

        assert 'Welcome to KoboToolbox, kobo_user!' not in html
        assert 'Activate My Account' not in html
        assert 'Help Center' not in html
        # Still a complete document, just without those two sections
        assert '<!doctype html>' in html
        assert 'kobotoolbox.org/privacy/' in html


class EmailPreviewTestCase(TestCase):
    """
    The browser previews of these emails keep working

    A broken preview surfaces only when somebody opens it, possibly long after
    whatever broke it.
    """

    def test_every_variant_renders(self):
        for preview in PREVIEWS:
            with self.subTest(preview.slug):
                message = render_preview(preview)

                assert message.subject
                assert ACTIVATE_URL in message.body
                assert ACTIVATE_URL in html_body(message)

    def test_rendering_leaves_the_instance_own_content_alone(self):
        """
        The customized variants write `EmailContent` rows and roll them back. If
        any of that escaped, opening a preview would rewrite the activation email
        a self-hosting admin had set up.
        """
        row = EmailContent.objects.create(
            email_name=EmailContent.EmailOptions.ACTIVATION_EMAIL,
            section_name=EmailContent.SectionOptions.SECTION_ONE,
            content='set by an admin',
        )

        for preview in PREVIEWS:
            render_preview(preview)

        assert list(EmailContent.objects.values_list('pk', flat=True)) == [row.pk]
        row.refresh_from_db()
        assert row.content == 'set by an admin'
