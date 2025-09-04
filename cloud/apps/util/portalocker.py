"""
Cross-platform (posix/nt) API for flock-style file locking.

Author: Jonathan Feinberg <jdf@pobox.com>,
        Lowell Alleman <lalleman@mfps.com>
Updated for Python 3 Compatibility.
"""
import os

__all__ = [
    "lock",
    "unlock",
    "LOCK_EX",
    "LOCK_SH",
    "LOCK_NB",
    "LockException",
]


class LockException(Exception):
    # Error codes:
    LOCK_FAILED = 1

if os.name == 'nt':
    import pywintypes
    import win32con
    import win32file
    LOCK_EX = win32con.LOCKFILE_EXCLUSIVE_LOCK
    LOCK_SH = 0  # the default
    LOCK_NB = win32con.LOCKFILE_FAIL_IMMEDIATELY
    __overlapped = pywintypes.OVERLAPPED()

elif os.name == 'posix':
    import fcntl
    LOCK_EX = fcntl.LOCK_EX
    LOCK_SH = fcntl.LOCK_SH
    LOCK_NB = fcntl.LOCK_NB
else:
    raise RuntimeError("PortaLocker only defined for nt and posix platforms")

if os.name == 'nt':
    def lock(file, flags):
        hfile = win32file._get_osfhandle(file.fileno())
        try:
            win32file.LockFileEx(hfile, flags, 0, -0x10000, __overlapped)
        except pywintypes.error as e:
            if e.args[0] == 33:  # ERROR_LOCK_VIOLATION
                raise LockException(LockException.LOCK_FAILED, e.args[2])
            else:
                raise

    def unlock(file):
        hfile = win32file._get_osfhandle(file.fileno())
        try:
            win32file.UnlockFileEx(hfile, 0, -0x10000, __overlapped)
        except pywintypes.error as e:
            if e.args[0] == 158:  # ERROR_INVALID_PARAMETER (already unlocked)
                pass  # Silently ignore this error to match posix behavior
            else:
                raise

elif os.name == 'posix':
    def lock(file, flags):
        try:
            fcntl.flock(file.fileno(), flags)
        except OSError as e:
            if e.errno == 11:  # Resource temporarily unavailable
                raise LockException(LockException.LOCK_FAILED, str(e))
            else:
                raise

    def unlock(file):
        fcntl.flock(file.fileno(), fcntl.LOCK_UN)

if __name__ == '__main__':
    import sys
    from time import localtime
    from time import strftime
    from time import time

    import portalocker

    log = open('log.txt', "a+")
    portalocker.lock(log, portalocker.LOCK_EX)

    timestamp = strftime("%m/%d/%Y %H:%M:%S\n", localtime(time()))
    log.write(timestamp)

    print("Wrote lines. Hit enter to release lock.")
    sys.stdin.readline()

    log.close()
