"""
Generic logging maker functions

Author: Thadeus Burgess

Copyright (c) 2011 Solar Power Technologies Inc.
"""

import logging
import logging.handlers
import platform
import os, sys
from logging.handlers import SysLogHandler

global _printlogger
_printlogger = True
global _loggerlevel
_loggerlevel = logging.DEBUG

class CloseHandlerLogger(logging.Logger):
    def __init__(self, *args, **kwargs):
        logging.Logger.__init__(self, *args, **kwargs)

    def close(self):
        #: copy array so it can be removed later
        handlers = self.handlers[:]

        for handler in handlers:
            self.removeHandler(handler)
            handler.close()

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
    root.setLevel(logging.INFO)

    # Always send logs to container stdout
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(logging.Formatter("%(name)s|%(asctime)s: %(levelname)s: %(message)s"))
    root.addHandler(sh)

    _add_syslog_if_available(root)


def make_logger(name, printlogger=False):
    logger = logging.getLogger(name)

    formatter = logging.Formatter('%(name)s|%(asctime)s: %(levelname)s: %(message)s')


    hdlr = logging.handlers.SysLogHandler(address='/dev/log',  facility=logging.handlers.SysLogHandler.LOG_DAEMON)

    logger.addHandler(hdlr)

    if printlogger or _printlogger:
        print_hdlr = logging.StreamHandler()
        print_hdlr.setFormatter(formatter)
        print_hdlr.setLevel(_loggerlevel)
        logger.addHandler(print_hdlr)

    logger.setLevel(_loggerlevel)

    return logger

class LoggerMixin(object):
    def __init__(self):
        self.logger = make_logger(self.__class__.__name__)

        super(LoggerMixin, self).__init__()
