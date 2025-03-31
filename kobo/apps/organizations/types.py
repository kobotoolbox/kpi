from datetime import datetime
from typing import Literal, TypedDict

UsageType = Literal['characters', 'seconds', 'submission', 'storage']


class BillingDates(TypedDict):
    start: datetime
    end: datetime


class UsageLimits(TypedDict):
    storage_limit: float
    submission_limit: float
    seconds_limit: float
    characters_limit: float


class NLPUsage(TypedDict):
    seconds: int
    characters: int
