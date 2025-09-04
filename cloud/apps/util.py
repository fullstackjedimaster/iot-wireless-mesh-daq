import datetime
import functools
import glob
import gzip
import os.path
from io import StringIO
from typing import Any
from typing import Callable
from typing import Dict
from typing import List
import pytz
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
from fastapi.responses import RedirectResponse


# Utility functions for paths and files
def data_path(request: Request) -> str:
    """Get the data path from the request state or default to '/data'."""
    basedir = "/data"
    if hasattr(request.app.state, "DATA_PATH"):
        basedir = request.app.state.DATA_PATH
    return basedir


def graph_data_path(request: Request) -> str:
    """Get the graph data path from the request state or use the default."""
    basedir = "../../test_data/redisSiteArrays"
    if hasattr(request.app.state, "GRAPH_DATA_PATH"):
        basedir = request.app.state.GRAPH_DATA_PATH
    return basedir


def mkfile_site_path(operator: str, administrator: str, sitename: str, request: Request) -> str:
    """Construct the path for a site."""
    path_tuple = (data_path(request), administrator, operator, sitename)
    return os.path.join(*path_tuple)


def mkfile_daily_path(operator: str, administrator: str, sitename: str, date_str: str, request: Request) -> str:
    """Construct the daily path for a site."""
    path_array = [mkfile_site_path(operator, administrator, sitename, request)]
    year_str, month_str, day_str = date_str.split("-")
    path_array.append(year_str)
    path_array.append(month_str.lstrip("0"))
    path_array.append(day_str.lstrip("0"))
    return os.path.join(*path_array)


def daily_mkfiles(operator: str, administrator: str, sitename: str, date_str: str, request: Request) -> List[str]:
    """Retrieve daily metakit files."""
    path = mkfile_daily_path(operator, administrator, sitename, date_str, request)
    pattern = path + "/*.mk"
    print(("daily_mkfiles glob pattern:", pattern))
    return glob.glob(pattern)


def mkfile_full_path(mkfilename: str, request: Request) -> str:
    """Get the full path for a metakit file."""
    date_str = mkfilename.split("_")[0]
    operator, administrator, sitename = request.state.mgr.abbrevs()
    if not mkfilename.endswith(".mk"):
        mkfilename += ".mk"
    return mkfile_daily_path(operator, administrator, sitename, date_str, request) + "/" + mkfilename


# Functions for local time and date
def localtime(request: Request) -> datetime.datetime:
    """Return local time for the current site array."""
    dt = datetime.datetime.now(pytz.timezone("UTC"))
    return dt.astimezone(request.state.tz)


def localdate(request: Request) -> datetime.date:
    """Return local date for the current site array."""
    return localtime(request).date()


# Whitelists for inputs and devices
input_dev_whitelist = [
    "id", "devtype", "label", "ulabel", "shapes", "bounds", "x", "y", "parent",
    "model_number", "monitors", "attached", "panel-serial", "SentalisId",
]


def input_whitelist(input_array: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Whitelist input devices."""
    new_inputs = []
    for subdict in input_array:
        new_dict = {k: v for k, v in list(subdict.items()) if k in input_dev_whitelist}
        new_inputs.append(new_dict)
    return new_inputs


sitearray_whitelist = [
    "id", "CurrencySymbol", "pref_rotation", "devtypes", "devtype", "label",
    "shapes", "bounds", "location", "address", "city", "state", "country",
    "zipcode", "timezone", "north_offset", "AC_metering", "inverter_metering",
    "inverters", "recombiners", "combiners", "strings", "panels", "monitors",
    "SentalisId",
]


def devices_whitelist(sa_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Whitelist devices for a site array."""
    return {k: v for k, v in list(sa_dict.items()) if k in sitearray_whitelist}





# Dependency injection for request state and session
def get_sitename(request: Request) -> str:
    """Get sitename from the request state or raise an exception."""
    sitename = getattr(request.state, "sitename", None)
    if not sitename:
        raise HTTPException(status_code=400, detail="Sitename is required.")
    return sitename


def set_sitename(request: Request, sitename: str) -> None:
    """Set the sitename in the request state."""
    request.state.sitename = sitename


# Decorators and session managemen
def sitename_required(f: Callable):
    """Decorator to require a sitename in the request state."""
    async def wrapper(*args, request: Request, **kwargs):
        sitename = get_sitename(request)
        if not sitename:
            # Use RedirectResponse instead of Flask's redirect
            return RedirectResponse(url="/sitedata/dashboard", status_code=303)
        return await f(*args, **kwargs)
    return wrapper


def init_session():
    return None

def compress_json_response(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        response = func(*args, **kwargs)
        # Gzip good responses with large data provided as json
        if response.status_code == 200 and len(response.data) > (1024 * 16) and \
            'Content-Encoding' not in response.headers and response.mimetype == 'application/json':
            gzip_buffer = StringIO()
            gzip_file = gzip.GzipFile(mode='wb', compresslevel=6, fileobj=gzip_buffer)
            gzip_file.write(response.data)
            gzip_file.close()
            response.data = gzip_buffer.getvalue()
            response.headers['Content-Encoding'] = 'gzip'
            response.headers['Content-Length'] = str(len(response.data))
        return response
    return wrapper
