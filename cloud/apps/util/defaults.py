"""
Reasonable defaults for DAQ

Author: Thadeus Burgess

Copyright (c) 2011 Solar Power Technologies Inc.
"""

default_config = (
             ('DAQ', 'OPERATION_MODE', '0', 'int', 'What mode is DAQ running in?'),
             ('DAQ', 'OPERATION_DATA', '', 'str', 'Data for the operation modes'),
             ('DAQ', 'REPORT_INTERVAL', '48', 'int', '<seconds> How often to query monitors'),
             ('DAQ', 'MIN_REPORT_INTERVAL', '6', 'int', '<seconds> Minimum the report interval should ever go'),
             ('DAQ', 'MAX_REPORT_INTERVAL', '300', 'int', '<seconds> Maximum the report interval should ever go'),
             ('DAQ', 'AUTO_REPORT_INTERVAL', 'False', 'bool', 'Automatically adjust reporting interval?'),
             ('DAQ', 'NUM_PER_PACKET', '6', 'int', 'How many data points an monitor returns'),
             ('DAQ', 'TIMESYNC_INTERVAL', '45', 'int', 'How often to send out timesync messages'),
             #: SPAM SHUTDOWN COUNT IS NOT USED
             ('DAQ', 'SPAM_SHUTDOWN_COUNT', '3', 'int', 'How many broadcast shutdown packets to send at once.'),
             ('DAQ', 'NICENESS', '1.0', 'float', 'Controls responsiveness of site server vs. CPU utilization'),

             ('RABBITMQ', 'HOST', 'localhost', 'str', 'Server to connect to its instance of rabbit'),
             ('RABBITMQ', 'PORT', '5672', 'int', 'Port for server connection'),
             ('RABBITMQ', 'VIRTUAL_HOST', '/endpoints', 'str', 'Virtual host to connect to'),
             ('RABBITMQ', 'USERNAME', 'spti', 'str', 'Username for rabbit authentication'),
             ('RABBITMQ', 'PASSWORD', 'spti2011', 'str', 'Password for rabbit authentication'),
             ('RABBITMQ', 'HEARTBEAT', '300', 'int', 'How many seconds to send heartbeats on idle connection?'),

             ('EPHEM', 'LAT', '30.30', 'str', ''),
             ('EPHEM', 'LON', '-97.70', 'str', ''),
             ('EPHEM', 'SLEEP_NO_SUN', '300', 'int', '<seconds> if sleep_all_night is False, then sleep for this amount of time'),
             ('EPHEM', 'SLEEP_ALL_NIGHT', 'True', 'bool', 'If True, sleep until sunrise, otherwise will sleep for sleep_no_sun'),
             ('EPHEM', 'SLEEP', 'False', 'bool', 'If true, will sleep during the night, otherwise will always collect data'),
             ('EPHEM', 'MAX_NIGHT', '84000', 'int', '<seconds> Maximum amount of time DAQ should ever sleep'),
             ('DEVICES', 'REPORT_INTERVAL', '5', 'int', '<seconds> How often to attempt and query connected devices'),
             ('DEVICES', 'AUTO_REPORT_INTERVAL', 'False', 'bool', 'Automatically adjust reporting interval for devices?'),
             ('DEVICES', 'ALL', '''[
{"identifier": "CBW",
 "args": [],
 "kwargs": {
     "url": "http://172.28.0.2/state.xml"
 }
}
]''', 'str', 'JSON encoded string representing all connected devices and their configuration parameters'),
             ('DEVICES', 'CONVERT_IRRADIANCE', 'False', 'bool', 'Convert irradiance from Kw/m2 to w/m2.'))
# ,
# {"identifier": "SHARK 100",
# "args": ["172.28.0.3"],
# "kwargs": {}
# }

def format_for_rst_doc(pad=40):
    txt = '\n'

    for kkey, key, value, type, doc in default_config:
        item = '``%s.%s``' % (kkey, key)
        item = item.ljust(pad)
        item += '%s(%s)' % (type, str(value))
        item += ' %s' % (doc)

        txt += item + '\n'

    txt = txt.strip()

    return txt

TEMPLATE_REVERSE_SSH = 'ssh -p 13003 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -o ExitOnForwardFailure=yes -i /opt/siteserver/id_rsa -g -n -N -R %(SSH_PORT)s:localhost:22 %(SSH_USER)s@%(SSH_HOST)s'

template_dhcp_etc_network_interfaces = '''
# This file describes the network interfaces available on your system
# and how to activate them. For more information, see interfaces(5).

# The loopback network interface
auto lo
iface lo inet loopback

# The primary network interface
auto eth1
iface eth1 inet dhcp

auto eth0
iface eth0 inet static
    address 172.28.0.1
    netmask 255.255.255.0
    network 172.28.0.0
    broadcast 172.28.0.255
    gateway 172.28.0.1
'''

template_static_etc_network_interfaces = '''
# This file describes the network interfaces available on your system
# and how to activate them. For more information, see interfaces(5).

# The loopback network interface
auto lo
iface lo inet loopback

# The primary network interface
auto eth1
iface eth1 inet static
    address %(address)s
    netmask %(netmask)s
    gateway %(gateway)s

auto eth0
iface eth0 inet static
    address 172.28.0.1
    netmask 255.255.255.0
    network 172.28.0.0
    broadcast 172.28.0.255
    gateway 172.28.0.1

up route add default gw %(gateway)s
'''

