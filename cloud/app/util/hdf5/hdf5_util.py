import h5py
import os
import numpy as np
from typing import Any, Dict, List, Optional
from datetime import datetime


class HDF5Manager:

    BASE_DIR = "/data/hdf5/"

    def __init__(self, db_dir: str = None):
        self.db_dir = db_dir if db_dir else self.BASE_DIR
        os.makedirs(self.db_dir, exist_ok=True)

    def _get_h5_path(self, site_id: Optional[int] = None, table_name: Optional[str] = None) -> str:
        if site_id:
            return os.path.join(self.db_dir, f"site_{site_id}.h5")
        if table_name:
            return os.path.join(self.db_dir, f"{table_name}.h5")
        raise ValueError("Must specify either site_id or table_name.")

    def ensure_group(self, file: h5py.File, group_path: str):
        if group_path not in file:
            file.create_group(group_path)

    def write_panel_data(self, site_id: int, panel_id: int, timestamp: datetime, voltage: float, current: float, power: float, status: str, alert: str):
        file_path = self._get_h5_path(site_id)
        
        with h5py.File(file_path, "a") as file:
            panel_group = f"panels/panel_{panel_id}"
            self.ensure_group(file, panel_group)

            dataset_path = f"{panel_group}/data"
            dtype = np.dtype([("timestamp", "S32"), ("voltage", "f4"), ("current", "f4"), ("power", "f4"), ("status", "S16"), ("alert", "S16")])

            if dataset_path not in file:
                file.create_dataset(dataset_path, shape=(0,), maxshape=(None,), dtype=dtype, chunks=True)

            dataset = file[dataset_path]
            dataset.resize((dataset.shape[0] + 1,), axis=0)
            dataset[-1] = (timestamp.strftime("%Y-%m-%d %H:%M:%S").encode(), voltage, current, power, status.encode(), alert.encode())

    def write_monitor_data(self, site_id: int, monitor_id: int, timestamp: datetime, voltage: float, temperature: float, status: str):
        file_path = self._get_h5_path(site_id)
        with h5py.File(file_path, "a") as file:
            monitor_group = f"monitors/monitor_{monitor_id}"
            self.ensure_group(file, monitor_group)

            dataset_path = f"{monitor_group}/data"
            dtype = np.dtype([("timestamp", "S32"), ("voltage", "f4"), ("temperature", "f4"), ("status", "S16")])

            if dataset_path not in file:
                file.create_dataset(dataset_path, shape=(0,), maxshape=(None,), dtype=dtype, chunks=True)

            dataset = file[dataset_path]
            dataset.resize((dataset.shape[0] + 1,), axis=0)
            dataset[-1] = (timestamp.strftime("%Y-%m-%d %H:%M:%S").encode(), voltage, temperature, status.encode())

    def write_inverter_data(self, site_id: int, inverter_id: int, timestamp: datetime, ac_voltage: float, dc_current: float, efficiency: float):
        file_path = self._get_h5_path(site_id)
        with h5py.File(file_path, "a") as file:
            inverter_group = f"inverters/inverter_{inverter_id}"
            self.ensure_group(file, inverter_group)

            dataset_path = f"{inverter_group}/data"
            dtype = np.dtype([("timestamp", "S32"), ("ac_voltage", "f4"), ("dc_current", "f4"), ("efficiency", "f4")])

            if dataset_path not in file:
                file.create_dataset(dataset_path, shape=(0,), maxshape=(None,), dtype=dtype, chunks=True)

            dataset = file[dataset_path]
            dataset.resize((dataset.shape[0] + 1,), axis=0)
            dataset[-1] = (timestamp.strftime("%Y-%m-%d %H:%M:%S").encode(), ac_voltage, dc_current, efficiency)

    def query_site_data(self, site_id: int, component: str, component_id: int, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None):
        file_path = self._get_h5_path(site_id)
        with h5py.File(file_path, "r") as file:
            dataset_path = f"{component}/{component}_{component_id}/data"

            if dataset_path not in file:
                return []

            data = file[dataset_path][:]
            if start_time and end_time:
                filtered = [
                    row for row in data
                    if start_time <= datetime.strptime(row["timestamp"].decode(), "%Y-%m-%d %H:%M:%S") <= end_time
                ]
                return filtered
            return data


    def create_table(self, table_name: str, schema: Dict[str, str]):
        file_path = self._get_h5_path(table_name=table_name)
        with h5py.File(file_path, "a") as file:
            for col, dtype in schema.items():
                if col not in file:
                    file.create_dataset(col, shape=(0,), maxshape=(None,), dtype=dtype)

    def insert(self, table_name: str, data: Dict[str, Any]):
        file_path = self._get_h5_path(table_name=table_name)
        with h5py.File(file_path, "a") as file:
            for col, value in data.items():
                if col not in file:
                    dtype = np.array([value]).dtype
                    file.create_dataset(col, shape=(0,), maxshape=(None,), dtype=dtype)
                dataset = file[col]
                dataset.resize((dataset.shape[0] + 1,))
                dataset[-1] = value

    def query_table(self, table_name: str) -> List[Dict[str, Any]]:
        file_path = self._get_h5_path(table_name=table_name)
        result = []
        with h5py.File(file_path, "r") as file:
            data = {col: file[col][:].tolist() for col in file.keys()}
            for i in range(len(next(iter(data.values()), []))):
                result.append({col: data[col][i] for col in data})
        return result

    def delete(self, site_id: Optional[int] = None, table_name: Optional[str] = None):
        file_path = self._get_h5_path(site_id=site_id, table_name=table_name)
        if os.path.exists(file_path):
            os.remove(file_path)
