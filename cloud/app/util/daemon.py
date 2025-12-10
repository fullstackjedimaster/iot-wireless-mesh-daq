#!/usr/bin/env python

"""
Daemonizes a process using the double-fork trick
"""

# License: Public Domain
# http://www.jejik.com/articles/2007/02/a_simple_unix_linux_daemon_in_python/

import atexit
import os
import sys
import time
from signal import SIGTERM

class Daemon(object):
    """
    A generic daemon class.

    Usage: subclass the Daemon class and override the run() method
    """
    def __init__(self, pidfile,
                 redirect_std=True,
                 chdir=True,
                 stdin='/dev/null',
                 stdout='/dev/null',
                 stderr='/dev/null',
                 exit_on_fail=True):
        self.stdin = stdin
        self.stdout = stdout
        self.stderr = stderr
        self.pidfile = pidfile

        self.redirect_std = redirect_std
        self.chdir = chdir

        self.exit_on_fail = exit_on_fail

    def exit(self, errno):
        if self.exit_on_fail:
            sys.exit(errno)

        return False

    def daemonize(self):
        """
        do the UNIX double-fork magic, see Stevens' "Advanced
        Programming in the UNIX Environment" for details (ISBN 0201563177)
        http://www.erlenstar.demon.co.uk/unix/faq_2.html#SEC16
        """
        try:
            pid = os.fork()
            if pid > 0:
                # exit first parent
                return self.exit(0)
        except OSError as e:
            sys.stderr.write("fork #1 failed: %d (%s)\n" % (e.errno, e.strerror))
            return self.exit(1)

        # decouple from parent environment
        if self.chdir:
            os.chdir("/")

        os.setsid()
        os.umask(0)

        # do second fork
        try:
            pid = os.fork()
            if pid > 0:
                # exit from second parent
                return self.exit(0)
        except OSError as e:
            sys.stderr.write("fork #2 failed: %d (%s)\n" % (e.errno, e.strerror))
            return self.exit(1)

        # redirect standard file descriptors
        if self.redirect_std:
            sys.stdout.flush()
            sys.stderr.flush()
            si = open(self.stdin, 'r')
            so = open(self.stdout, 'a+')
            se = open(self.stderr, 'a+', 0)
            os.dup2(si.fileno(), sys.stdin.fileno())
            os.dup2(so.fileno(), sys.stdout.fileno())
            os.dup2(se.fileno(), sys.stderr.fileno())

        # write pidfile
        atexit.register(self.delpid)
        pid = str(os.getpid())

        try:
            os.makedirs(os.path.dirname(self.pidfile))
        except OSError:
            pass

        open(self.pidfile,'w+').write("%s\n" % pid)

        return True

    def delpid(self):
        try:
            os.remove(self.pidfile)
        except OSError:
            return False

        return True

    def start(self):
        """
        Start the daemon
        """
        # Check for a pidfile to see if the daemon already runs
        try:
            pf = open(self.pidfile,'r')
            pid = int(pf.read().strip())
            pf.close()
        except IOError:
            pid = None

        if pid:
            if self.is_running():
                message = "pidfile %s already exist. Daemon already running?\n"
                sys.stderr.write(message % self.pidfile)
                return self.exit(1)
            else:
                os.remove(self.pidfile)

        # Start the daemon
        status = self.daemonize()

        if status is True:
            self.run()

        return self.is_running()

    def stop(self):
        """
        Stop the daemon
        """
        # Get the pid from the pidfile
        try:
            pf = open(self.pidfile,'r')
            pid = int(pf.read().strip())
            pf.close()
        except IOError:
            pid = None

        if not pid:
            message = "pidfile %s does not exist. Daemon not running?\n"
            sys.stderr.write(message % self.pidfile)
            return # not an error in a restart

        # Try killing the daemon process
        try:
            os.kill(pid, SIGTERM)
        except OSError as err:
            err = str(err)
            if err.find("No such process") > 0:
                if os.path.exists(self.pidfile):
                    os.remove(self.pidfile)
            else:
                print( str(err))
                return self.exit(1)

        return self.is_running()

    def is_running(self):
        """
        Checks to see if the daemon is currently running
        """
        try:
            pf = open(self.pidfile, 'r')
            pid = int(pf.read().strip())
            pf.close()
        except IOError:
            pid = None

        if pid:
            return os.path.exists('/proc/%s' % str(pid))
        else:
            return False

    def restart(self):
        """
        Restart the daemon
        """
        self.stop()

        time.sleep(10)

        self.start()

        return self.is_running()

    def run(self):
        """
        You should override this method when you subclass Daemon. It will be called after the process has been
        daemonized by start() or restart().
        """
        pass

def main(daemon):
    if 'true' == 'true':
        daemon.run()
    else:
        if len(sys.argv) == 2:
            if 'start' == sys.argv[1]:
                daemon.start()
            elif 'stop' == sys.argv[1]:
                daemon.stop()
            elif 'restart' == sys.argv[1]:
                daemon.restart()
            elif 'force-reload' == sys.argv[1]:
                daemon.restart()
            elif 'status' == sys.argv[1]:
                if daemon.is_running():
                    print( "Running")
                else:
                    print( "Not Running")
                sys.exit(0)
            else:
                print("Unknown command")
                sys.exit(2)

            sys.exit(0)
        else:
            print("usage: %s start|stop|restart" % sys.argv[0])
            sys.exit(2)

if __name__ == "__main__":
    class MyDaemon(Daemon):
        def run(self):
            while True:
                time.sleep(1)

    daemon = MyDaemon('/tmp/daemon-example.pid')

    main(daemon)

