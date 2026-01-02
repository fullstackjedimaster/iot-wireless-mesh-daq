"""
Generic logging maker functions

Author: Thadeus Burgess
Copyright (c) 2011 Solar Power Technologies Inc.
"""

import logging
import os
import sys
from logging.handlers import SysLogHandler

# Env-controlled defaults:
#   LOG_LEVEL=WARNING|ERROR|INFO|DEBUG
#   PRINT_LOGS=0/1
#   LOG_TO_SYSLOG=0/1
DEFAULT_LEVEL = os.getenv("LOG_LEVEL", "WARNING").upper()
DEFAULT_PRINT = os.getenv("PRINT_LOGS", "0") == "1"

_level = getattr(logging, DEFAULT_LEVEL, logging.WARNING)


class CloseHandlerLogger(logging.Logger):
    def close(self):
        handlers = self.handlers[:]
        for h in handlers:
            try:
                self.removeHandler(h)
                h.close()
            except Exception:
                pass


logging.setLoggerClass(CloseHandlerLogger)


def _add_syslog_if_available(logger: logging.Logger) -> None:
    if os.getenv("LOG_TO_SYSLOG", "0") != "1":
        return

    for addr in ("/dev/log", "/var/run/syslog"):
        if os.path.exists(addr):
            try:
                h = SysLogHandler(address=addr)
                h.setFormatter(logging.Formatter("%(name)s: %(message)s"))
                logger.addHandler(h)
            except Exception:
                pass
            return


def setup_logging() -> None:
    root = logging.getLogger()
    root.setLevel(_level)

    # Avoid duplicate handlers if called multiple times
    if not any(isinstance(h, logging.StreamHandler) for h in root.handlers):
        sh = logging.StreamHandler(sys.stdout)
        sh.setFormatter(logging.Formatter("%(name)s|%(asctime)s: %(levelname)s: %(message)s"))
        sh.setLevel(_level)
        root.addHandler(sh)

    _add_syslog_if_available(root)


def make_logger(name: str, printlogger: bool = False) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(_level)

    # Prevent duplicate handlers on repeated calls
    if getattr(logger, "_configured", False):
        return logger
    logger._configured = True  # type: ignore[attr-defined]

    formatter = logging.Formatter("%(name)s|%(asctime)s: %(levelname)s: %(message)s")

    # Only add syslog if explicitly enabled AND socket exists
    _add_syslog_if_available(logger)

    # Print to stdout only if enabled
    if printlogger or DEFAULT_PRINT:
        h = logging.StreamHandler(sys.stdout)
        h.setFormatter(formatter)
        h.setLevel(_level)
        logger.addHandler(h)

    return logger


class LoggerMixin(object):
    def __init__(self):
        self.logger = make_logger(self.__class__.__name__)
        super(LoggerMixin, self).__init__()
