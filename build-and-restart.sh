#!/bin/bash
set -e

cd /opt/projects/iot-wireless-mesh-daq

# Rebuild each Python service
for srv in mesh cloud; do
  echo "[+] Rebuilding $srv..."
  cd $srv
  source .venv/bin/activate
  pip install -r requirements.txt
  cd ..
done

# Rebuild frontend
cd daq-ui
npm install
npm run build
cd ..

# Restart services
sudo systemctl restart meshserver
sudo systemctl restart cloud
sudo systemctl restart ui-daq

echo "✅ All components rebuilt and restarted."
