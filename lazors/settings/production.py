import os

from . import DEFAULT_DEV_KEY
from ._utils import parse_allowed_hosts

SECRET_KEY = os.environ.get('APP_SECRET_KEY', DEFAULT_DEV_KEY)

print(SECRET_KEY)
if SECRET_KEY in ["", DEFAULT_DEV_KEY]:
    raise KeyError("""
Environmental variable SECRET_KEY must be a non empty hash that differs from
the default development key.
""")

DEBUG = False

ALLOWED_HOSTS = parse_allowed_hosts(os.environ.get('APP_ALLOWED_HOST', '0.0.0.0'))
