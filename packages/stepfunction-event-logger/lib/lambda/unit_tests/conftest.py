import pytest
import json


@pytest.fixture
def mock_summary_logging_level_env_var(monkeypatch):
    monkeypatch.setenv("EVENT_LOGGING_LEVEL", "SUMMARY")
    return "SUMMARY"


@pytest.fixture
def mock_full_logging_level_env_var(monkeypatch):
    monkeypatch.setenv("EVENT_LOGGING_LEVEL", "FULL")
    return "FULL"


@pytest.fixture
def json_data(filepath):
    """
    Opens a json file as a dictionary. Expects test to be parametrized with
    "filepath", e.g.:
    @pytest.mark.parametrize("filepath", [my_filepath])
    """
    with open(filepath, "rb") as f:
        yield json.load(f)