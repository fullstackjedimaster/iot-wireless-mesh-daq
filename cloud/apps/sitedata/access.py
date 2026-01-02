from apps.database import SessionLocal
from apps.models import Site, SiteArray, String, Inverter, Panel, Monitor


class SiteManager:
    def __init__(self, sitename: str):
        self.db = SessionLocal()
        self.sitename = sitename
        self.site = self.db.query(Site).filter_by(sitename=sitename).first()

    def get_site(self):
        return self.site

    def get_sitearray(self):
        if not self.site:
            return None
        return self.db.query(SiteArray).filter_by(site_id=self.site.id).first()

    def get_strings(self):
        sitearray = self.get_sitearray()
        if not sitearray:
            return []
        return self.db.query(String).filter_by(sitearray_id=sitearray.id).all()

    def get_panels(self):
        strings = self.get_strings()
        string_ids = [s.id for s in strings]
        return self.db.query(Panel).filter(Panel.string_id.in_(string_ids)).all()

    def get_monitors(self):
        panels = self.get_panels()
        panel_ids = [p.id for p in panels]
        return self.db.query(Monitor).filter(Monitor.panel_id.in_(panel_ids)).all()

    def get_inverters(self):
        strings = self.get_strings()
        string_ids = [s.id for s in strings]
        return self.db.query(Inverter).filter(Inverter.string_id.in_(string_ids)).all()

    def get_panel_monitor_map(self):
        """
        Returns a dictionary mapping panel labels to monitor MACs.
        """
        monitors = self.get_monitors()
        panel_map = {}
        for monitor in monitors:
            panel = self.db.query(Panel).filter_by(id=monitor.panel_id).first()
            if panel:
                panel_map[panel.label] = monitor.macaddr
        return panel_map


if __name__ == "__main__":
    mgr = SiteManager("TEST")
    print("✅ Site:", mgr.get_site().sitename if mgr.get_site() else "None")
    print("✅ SiteArray:", mgr.get_sitearray().label if mgr.get_sitearray() else "None")
    print("✅ Panels:", [p.label for p in mgr.get_panels()])
    print("✅ Monitors:", [m.macaddr for m in mgr.get_monitors()])
    print("✅ Panel → Monitor Map:", mgr.get_panel_monitor_map())
