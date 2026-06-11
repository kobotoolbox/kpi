from __future__ import annotations

import constance

from kpi.utils.log import logging


# The server-wide Google region is stored in Constance as either 'US' or 'EU'.
# 'EU' must be used when EU data residency is required (all data must remain
# within Europe). 'US' is the default for all other deployments
GOOGLE_REGION_EU = 'EU'
GOOGLE_REGION_US = 'US'
GOOGLE_REGION_CHOICES = (GOOGLE_REGION_US, GOOGLE_REGION_EU)

DEFAULT_GOOGLE_REGION = GOOGLE_REGION_US

# 'us' and 'eu' are STT v2 multi-region endpoints with identical language
# support and model availability
SPEECH_LOCATION_BY_REGION = {
    GOOGLE_REGION_EU: 'eu',
    GOOGLE_REGION_US: 'us',
}

# Translation requests are routed through multi-region endpoints:
# `translate-eu.googleapis.com` keeps TLS termination and processing within the EU
# for EU data residency requirements, while `translate-us.googleapis.com` routes
# requests through the US multi-region
TRANSLATE_ENDPOINT_BY_REGION = {
    GOOGLE_REGION_EU: 'translate-eu.googleapis.com',
    GOOGLE_REGION_US: 'translate-us.googleapis.com',
}

TRANSLATE_LOCATION_BY_REGION = {
    GOOGLE_REGION_EU: 'europe-west1',
    GOOGLE_REGION_US: 'us-west1',
}


def get_google_region() -> str:
    """
    Return the configured ASR/MT Google processing region ('US' or 'EU')

    Reads ASR_MT_GOOGLE_REGION from constance at call time, so an admin can
    change the region without restarting the server. Tolerates lower-case input
    and falls back to 'US' with a warning if an unrecognised value is set
    """
    region = str(constance.config.ASR_MT_GOOGLE_REGION).upper()
    if region in GOOGLE_REGION_CHOICES:
        return region

    logging.warning(
        'Invalid ASR_MT_GOOGLE_REGION=%s; defaulting to %s',
        region,
        DEFAULT_GOOGLE_REGION,
    )
    return DEFAULT_GOOGLE_REGION


def get_speech_location() -> str:
    return SPEECH_LOCATION_BY_REGION[get_google_region()]


def get_translate_endpoint() -> str:
    return TRANSLATE_ENDPOINT_BY_REGION[get_google_region()]


def get_translate_location() -> str:
    return TRANSLATE_LOCATION_BY_REGION[get_google_region()]
