import pytest


def pytest_addoption(parser):
    parser.addoption(
        "--stripe",
        action="store_true",
        default=False,
        help="Run tests that modify (testmode) Stripe objects."
             "Requires Stripe to be fully configured and webhooks to be accessible by outside traffic."
             "NOTE: These tests **will** modify data in your Stripe tables. Never run them on production servers."
    )


def pytest_configure(config):
    config.addinivalue_line("markers", "stripe: mark test that mutates data on Stripe")


def pytest_collection_modifyitems(config, items):
    if config.getoption("--stripe"):
        return
    stripe = pytest.mark.skip(reason="Use the --stripe option to run this test")
    for item in items:
        if "stripe" in item.keywords:
            item.add_marker(stripe)
