from sqlalchemy import (
    Column, Date, DateTime, Float, ForeignKey, Integer,
    String, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship, backref
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class Site(Base):
    __tablename__ = "site"

    id = Column(Integer, primary_key=True)
    integrator = Column(String(32))
    owner = Column(String(32))
    sitename = Column(String(32), unique=True)

    __table_args__ = (UniqueConstraint('integrator', 'owner', 'sitename'),)

    def __repr__(self):
        return f"<Site {self.sitename}>"


class SiteData(Base):
    __tablename__ = "site_data"

    id = Column(Integer, primary_key=True, index=True)
    integrator = Column(String(12))
    owner = Column(String(16))
    sitename = Column(String(12), unique=True)
    location = Column(String(32))
    version = Column(String(8))
    timezone = Column(String(32))
    json = Column(Text)  # the actual site_graph JSON
    sa_node_id = Column(String(12))  # root node ID in the graph

    def __repr__(self):
        return f"<SiteData sitename={self.sitename}, id={self.id}>"


class SiteArray(Base):
    __tablename__ = "site_array"

    id = Column(Integer, primary_key=True)
    site_id = Column(Integer, ForeignKey("site.id"))
    site = relationship("Site", backref=backref("arrays", lazy="dynamic"))
    label = Column(String(32))
    version = Column(String(8))
    status = Column(String(32), default="OK")
    timezone = Column(String(24), default="America/Chicago")
    commission_date = Column(Date)
    decommission_date = Column(Date)
    last_service_date = Column(DateTime)
    last_cleaning_date = Column(DateTime)
    center_lat = Column(Float)
    center_lon = Column(Float)
    offset_dir = Column(Float, default=180.0)
    extent_hi_x = Column(Integer, default=0)
    extent_hi_y = Column(Integer, default=0)
    extent_lo_x = Column(Integer, default=0)
    extent_lo_y = Column(Integer, default=0)
    preferred_rotation = Column(Integer, default=0)

    def __repr__(self):
        return f"<SiteArray {self.site.sitename}>"


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True)
    manufacturer = Column(String(255), nullable=False)
    model = Column(String(255), nullable=False)

    def __repr__(self):
        return f"<Equipment {self.manufacturer} {self.model}>"


class Inverter(Base):
    __tablename__ = "inverters"

    id = Column(Integer, primary_key=True)
    serial_number = Column(String(255), unique=True, nullable=False)

    def __repr__(self):
        return f"<Inverter {self.serial_number}>"


class String(Base):
    __tablename__ = "strings"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    inverter_id = Column(Integer, ForeignKey("inverters.id"), nullable=False)
    inverter = relationship("Inverter", backref=backref("strings", lazy="dynamic"))

    def __repr__(self):
        return f"<String {self.name}>"


class Monitor(Base):
    __tablename__ = "monitors"

    id = Column(Integer, primary_key=True)
    mac_address = Column(String(17), unique=True, nullable=False)
    node_id = Column(String(50), unique=True, nullable=False)
    string_id = Column(Integer, ForeignKey("strings.id"), nullable=False)
    string = relationship("String", backref=backref("monitors", lazy="dynamic"))
    string_position = Column(Integer, nullable=False)

    def __repr__(self):
        return f"<Monitor {self.node_id}>"


class Panel(Base):
    __tablename__ = "panels"

    id = Column(Integer, primary_key=True)
    serial_number = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    monitor_id = Column(Integer, ForeignKey("monitors.id"), unique=True, nullable=False)
    inverter_id = Column(Integer, ForeignKey("inverters.id"), nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)

    monitor = relationship("Monitor", backref="panel")
    inverter = relationship("Inverter", backref="panels")
    equipment = relationship("Equipment", backref="panels")

    def __repr__(self):
        return f"<Panel {self.serial_number}>"


class Gateway(Base):
    __tablename__ = "gateways"

    id = Column(Integer, primary_key=True)
    mac_address = Column(String(17), unique=True, nullable=False)
    ip_address = Column(String(45), unique=True, nullable=False)

    def __repr__(self):
        return f"<Gateway {self.mac_address}>"


class SiteGraph(Base):
    __tablename__ = "site_graph"

    id = Column(Integer, primary_key=True)
    sitearray_id = Column(Integer, ForeignKey("site_array.id"))
    sitearray = relationship("SiteArray", backref=backref("site_graph", lazy="dynamic"))
    r_graph_id = Column(String(12))
    json = Column(Text)

    def __repr__(self):
        return f"<SiteGraph {self.r_graph_id}>"
