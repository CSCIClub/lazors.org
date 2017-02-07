#!/bin/bash
set -3

start_redis() {
    service redis-server start
    echo
    echo "Redis server started"
    echo
}

start_redis

exec /usr/bin/python3 manage.py "$@"
