"""
Base mixin classes used to create attributes for an instance of a ProcessBase.

Author: Thadeus Burgess

Copyright (c) 2011 Solar Power Technologies Inc.
"""


class AttributeBase(object):
    def __init__(self, **kwargs):
        super(AttributeBase, self).__init__()

    def start(self):
        pass

    def stop(self):
        pass

    def check(self):
        pass

    def kill(self):
        pass
