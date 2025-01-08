from dataclasses import dataclass


@dataclass
class SubmissionUpdate:
    status: str
    action: str
    id: int
    username: str = 'AnonymousUser'

    def __post_init__(self):
        self.username = 'AnonymousUser' if self.username is None else self.username
