from __future__ import annotations

import constance

from kpi.utils.log import logging


# Server-wide Google region setting stored in Constance:
# GLOBAL (default) - use the best model for every language, routing per-language
# to whichever Google endpoint hosts that model.
# EU - restrict all processing to EU-hosted Google endpoints for data residency
# compliance; languages unavailable in EU become unsupported.
GOOGLE_REGION_EU = 'eu'
GOOGLE_REGION_GLOBAL = 'global'
GOOGLE_REGION_CHOICES = (GOOGLE_REGION_GLOBAL, GOOGLE_REGION_EU)

DEFAULT_GOOGLE_REGION = GOOGLE_REGION_GLOBAL

# EU equivalents per model:
#   chirp_3  → 'eu'            (us/eu multi-region, chirp_3 support)
#   chirp_2  → 'europe-west4'  (EU sub-region with chirp_2 support)
#   chirp    → 'europe-west4'  (EU sub-region with chirp support)
#   long     → 'eu'            (us/eu multi-region, long model)
EU_LOCATION_BY_MODEL = {
    'chirp_3': 'eu',
    'chirp_2': 'europe-west4',
    'chirp':   'europe-west4',
    'long':    'eu',
}

# MT (Translation v3) endpoint and location mapping
TRANSLATE_ENDPOINT_BY_REGION = {
    GOOGLE_REGION_EU: 'translate-eu.googleapis.com',
    GOOGLE_REGION_GLOBAL: 'translate-us.googleapis.com',
}

TRANSLATE_LOCATION_BY_REGION = {
    GOOGLE_REGION_EU: 'europe-west1',
    GOOGLE_REGION_GLOBAL: 'us-west1',
}


def get_google_region() -> str:
    """
    Return the configured ASR/MT Google processing region ('global' or 'eu')
    """
    region = str(constance.config.ASR_MT_GOOGLE_REGION).lower()
    if region in GOOGLE_REGION_CHOICES:
        return region

    logging.warning(
        'Invalid ASR_MT_GOOGLE_REGION=%s; defaulting to %s',
        region,
        DEFAULT_GOOGLE_REGION,
    )
    return DEFAULT_GOOGLE_REGION


def get_speech_location_for_model(model_code: str | None) -> str | None:
    """
    Return the EU speech location for the given model, or None in GLOBAL mode,
    in which case the caller must use location_code from the database
    """
    if get_google_region() == GOOGLE_REGION_EU:
        return EU_LOCATION_BY_MODEL.get(model_code, 'eu')
    return None


def get_speech_location_for_region() -> str:
    return 'eu' if get_google_region() == GOOGLE_REGION_EU else 'us'


def get_translate_endpoint() -> str:
    return TRANSLATE_ENDPOINT_BY_REGION[get_google_region()]


def get_translate_location() -> str:
    return TRANSLATE_LOCATION_BY_REGION[get_google_region()]


def get_asr_language_code_overrides() -> dict[str, str]:
    """
    Return the active ASR language code overrides from Constance

    This is used to work around broken Google Speech-to-Text locale pipelines
    without requiring a code deploy. When a locale code is present in the
    returned dict, google_transcribe.py sends the mapped value to Google's
    language_codes[] instead of the configured locale.

    The Constance value is a comma-separated list of `source:target` pairs
    (e.g. `sw:auto,sw-KE:auto`) that can be set via Django admin for
    an immediate hotfix, or pre-populated from the ASR_LANGUAGE_CODE_OVERRIDES
    environment variable in the deployment config so all managed instances pick
    it up automatically.

    Malformed entries (missing `:`, empty source, or empty target) are
    skipped individually and logged, so one bad entry in the Constance value
    does not discard the other valid overrides.
    """
    raw = str(constance.config.ASR_LANGUAGE_CODE_OVERRIDES).strip()
    if not raw:
        return {}

    overrides: dict[str, str] = {}
    for item in raw.split(','):
        item = item.strip()
        if not item:
            continue

        if ':' not in item:
            logging.info(
                'Ignoring invalid ASR language override %r. '
                "Expected format 'source:target'.",
                item,
            )
            continue

        source, target = (
            value.strip()
            for value in item.split(':', 1)
        )

        if not source or not target:
            logging.info(
                'Ignoring invalid ASR language override %r.',
                item,
            )
            continue

        overrides[source] = target

    return overrides
