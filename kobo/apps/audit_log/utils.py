from dataclasses import dataclass


@dataclass
class SubmissionUpdate:
    id: int
    action: str
    username: str = 'AnonymousUser'
    status: str | None = None

    def __post_init__(self):
        self.username = 'AnonymousUser' if self.username is None else self.username
