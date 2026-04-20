from gemini_service import get_gemini_client, is_enabled


def test_disabled_sem_key(app):
    with app.app_context():
        app.config["GEMINI_API_KEY"] = ""
        assert is_enabled() is False
        assert get_gemini_client() is None


def test_enabled_com_key(app):
    with app.app_context():
        app.config["GEMINI_API_KEY"] = "fake-test-key"
        assert is_enabled() is True
