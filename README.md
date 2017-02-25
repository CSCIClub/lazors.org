# Lazors.org

A multiplayer video game to fly around and shoot each other. Anybody who visits
the URL can enter the battle.

## Quick start

Note: Make sure you are using python 3

```
virtualenv venv
source venv/bin/active
pip install -r requirements.txt

# omitting secret_key is ok but is here for reference
ALLOWED_HOSTS=0.0.0.0 SECRET_KEY=$your_secret_key python manage.py runserver 0.0.0.0:8000
```

## Getting Started

to run locally: 

APP_ALLOWED_HOSTS=[ipaddress] python3 manage.py [ipaddress]:8000 this will host
the game port 8000 in LAN for people to play with you

## Deployment

magic on the server daphne probs

## Contributing

feel free to clone and improve, if it runs on your LAN it'll probably work fine
online

## Authors

Jeff, Wes

## Contributers

Jared Rickert
