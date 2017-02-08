import os

from . import DEFAULT_DEV_KEY
from ._utils import parse_allowed_hosts

SECRET_KEY = os.environ.get('APP_SECRET_KEY', DEFAULT_DEV_KEY)

DEBUG = True

ALLOWED_HOSTS = parse_allowed_hosts(os.environ.get('APP_ALLOWED_HOST', '0.0.0.0'))
