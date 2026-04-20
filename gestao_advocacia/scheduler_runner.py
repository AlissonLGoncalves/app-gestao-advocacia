import os
import time

from app import create_app
from app_runtime import configure_scheduler


def bootstrap_scheduler_app():
    os.environ["FLY_PROCESS_GROUP"] = "scheduler"
    app = create_app()
    configure_scheduler(app)
    return app


def main():
    bootstrap_scheduler_app()
    while True:
        time.sleep(60)


if __name__ == "__main__":
    main()
