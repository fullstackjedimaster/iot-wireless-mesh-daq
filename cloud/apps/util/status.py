# apps/util/status.py

def compute_status(voltage, current):
    if voltage is None or current is None:
        return "unknown"

    if voltage < 10 or current < 1:
        return "alert"  # red
    elif voltage < 15 or current < 2:
        return "warning"  # yellow
    elif voltage < 20:
        return "info"  # blue
    else:
        return "normal"  # grey
