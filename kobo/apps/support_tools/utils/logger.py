NORMAL = 1
VERBOSE = 2
DEBUG = 3


class RestoreLogger:
    """
    Collect the log of a run and echo it as it goes, keeping only the messages
    the verbosity asks for.

    A message is logged at a level: `NORMAL` for what the run does, `VERBOSE`
    for how it works through the project, `DEBUG` for how it reaches each
    decision. It is kept, and echoed, only when its level is at most
    `verbosity`, so a run can log everywhere and the caller decides how much of
    it to see: `--verbosity` in the shell, `NORMAL` in the admin, where the kept
    lines are written to the job's row.
    """

    def __init__(self, verbosity: int = NORMAL, echo: callable = None):
        self.verbosity = verbosity
        self.echo = echo
        self.lines = []

    def __call__(self, message: str, level: int = NORMAL):
        if level > self.verbosity:
            return

        self.lines.append(message)

        if self.echo:
            self.echo(message)
