from app import create_app
from app_runtime import configure_scheduler
from config_test import ConfigTest


class FakeScheduler:
    def __init__(self):
        self.jobs = {}
        self.running = False
        self.inited = False

    def init_app(self, app):
        self.inited = True

    def get_job(self, job_id):
        return self.jobs.get(job_id)

    def add_job(self, id, func, trigger, replace_existing=True, **kwargs):
        self.jobs[id] = {
            "id": id,
            "func": func,
            "trigger": trigger,
            "replace_existing": replace_existing,
            **kwargs,
        }

    def get_jobs(self):
        return list(self.jobs.values())

    def start(self, paused=False):
        self.running = True


def test_scheduler_runner_inicia_jobs(monkeypatch):
    fake = FakeScheduler()
    monkeypatch.setattr("app_runtime.scheduler", fake)
    monkeypatch.setenv("FLY_PROCESS_GROUP", "scheduler")

    app = create_app(ConfigTest)
    app.config["TESTING"] = False
    app.config["CNJ_JOB_ENABLED"] = True
    app.config["DJEN_JOB_ENABLED"] = False

    configure_scheduler(app)

    job_ids = {j["id"] for j in fake.get_jobs()}
    assert "VerificarProcessosCNJJob" in job_ids
    assert "VerificarAlertasPrazosJob" in job_ids
    assert fake.running is True


def test_app_process_nao_inicia_scheduler(monkeypatch):
    fake = FakeScheduler()
    monkeypatch.setattr("app_runtime.scheduler", fake)
    monkeypatch.setenv("FLY_PROCESS_GROUP", "app")

    app = create_app(ConfigTest)
    app.config["TESTING"] = False
    app.config["CNJ_JOB_ENABLED"] = True

    configure_scheduler(app)

    assert fake.get_jobs() == []
    assert fake.running is False
