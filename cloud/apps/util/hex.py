"""
Hex conversion utilities.

Author: Thadeus Burgess

Copyright (c) 2011 Solar Power Technologies Inc.
"""

import binascii
import math
import struct

from numpy.compat import unicode

HALF_NAN    = 0x7E00
HALF_NINF   = 0xFC00
HALF_INF    = 0x7C00

HALF_ZERO   = 0x0000
HALF_NZERO  = 0x8000

HALF_ONE    = 0x3C00
HALF_NEGONE = 0xBC00

def uint32_to_sint32(value):
    """
    Converts an unsigned int to a signed int.

    >>> uint_to_sint(0xb)
    -5
    >>> uint_to_sint(0xfb)
    -5
    >>> uint_to_sint(0xffffb)
    -5
    >>> uint_to_sint(0xffffffffffffffffffffffffb)
    -5L
    """
    if value & (1<<31) != 0:
        value = value - (1<<32)
    return value

def int_to_float(value):
    """
    Encodes an integer value bits as a IEEE 754 binary32 floating point number
    """
    return struct.unpack('f', struct.pack('I', value))[0]

def int_to_hex(value, padding=None):
    """
    Convert an integer into hexidecimal string representation

    :param padding: Add X 0 padding to the hex
    :return: str

    >>> int_to_hex(15)
    'F'
    >>> int_to_hex(34)
    '22'
    >>> int_to_hex(34, 4)
    '0022'
    >>> int_to_hex(300, 4)
    '012C'
    """
    value = abs(int(value))

    hex = ''
    if padding:
        hex = '%0*X' % (padding, value)
    else:
        hex = '%X' % (value)
    return hex

def float_to_hex(value):
    """
    Converts a float into a two-byte hexidecimal string that
    assumes the radix is 8.8

    >>> float_to_hex(15.53)
    '0F35'
    >>> float_to_hex(45.233112324)
    '2D17'
    >>> float_to_hex(123.321)
    '7B20'
    """
    value = float(value)

    decimal, whole = math.modf(value)

    hex = "%0*X" % (2, int(whole))
    hex += "%0*X" % (2, int(round(decimal * 100)))

    return hex

def half_to_float(h):
    """
    Converts a IEEE half-precision (16-bit) floating point format into a full
    python float.

    >>> half_to_float(0x3C00)
    1.0
    >>> half_to_float('3C00')
    1.0
    >>> half_to_float('C000')
    -2.0
    """
    if isinstance(h, (str, unicode)):
        h = int(h, 16)

    if h in (HALF_NAN, HALF_NINF, HALF_INF):
        return float('nan')
    elif h == HALF_ZERO or h == HALF_NZERO:
        return 0.0
    elif h == HALF_ONE:
        return 1.0
    elif h == HALF_NEGONE:
        return -1.0

    s = int((h >> 15) & 0x00000001)    # sign
    e = int((h >> 10) & 0x0000001f)    # exponent
    f = int(h & 0x000003ff)            # fraction

    e = e + (127 -15) # +112
    f = f << 13

    value = int((s << 31) | (e << 23) | f)

    # hack to coerce int to float
    value = struct.pack('I', value)
    value = struct.unpack('f', value)

    return value[0]

def _u(str_hex):
    """
    Short proxy for binascii.unhexlify
    """
    if str_hex is None:
        return ''

    return binascii.unhexlify(str_hex)

def _h(hex):
    """
    Short proxy for binascii.hexlify
    """
    if hex is None:
        return ''

    return binascii.hexlify(hex).upper()
