from django.conf import settings


def rewrite_internal_url_to_external(internal_enketo_url: str) -> str:
    if isinstance(internal_enketo_url, str) and internal_enketo_url.startswith(
        settings.ENKETO_INTERNAL_URL
    ):
        return (
            settings.ENKETO_URL
            + internal_enketo_url[len(settings.ENKETO_INTERNAL_URL) :]  # noqa
        )
    return internal_enketo_url
