# Homebridge YeeLight Wi-Fi

[YeeLight](https://www.yeelight.com) plugin for [Homebridge](https://github.com/nfarina/homebridge) supporting Wi-Fi lighting devices.

This allows you to control your **YeeLight** wi-fi devices, such as the YeeLight Bulb and the YeeLight Stripe with [HomeKit](https://www.apple.com/ios/home) and Siri. No apps required.

## Requirements

- Node.js >= 7.6.0
- Avahi

## Installation

1. Install homebridge, `sudo npm install -g homebridge`
2. Install this plugin using, `npm install -g homebridge-yeelight-wifi`

## Setting up devices

Devices that already have the API enabled should be autodiscovered without any other
actions on your part.

However, out of the factory, the YeeLight devices do come with the API disabled and
you will have to enable it for them to work with Homebridge. To do so, go to settings
and enable **Developer Mode**.

## Configuration (Optional)

The following parameters can be changed in case you need to change the defaults.

```json
{
    "bridge": {
        "name": "Raspberry Pi",
    },
    "accessories": [{
    }],
    "platforms": [{
        "platform": "yeelight",
        "name": "Yeelight",
        "transitions": {
            "power": 400,
            "brightness": 400
        },
        "multicast": {
            "interface": "0.0.0.0"
        }
    }]
}
```

## Motivation

When I got my first YeeLight bulb, there was already a homebridge plugin supporting
it, however, it did not deal with transient failures. Frequently I would turn on a
lamp, it would report it as *On* but no sign of light could be seen. Manually turning
the lamp off and on would solve the issue but was a nuisance.

This plugin was born to solve this issue and end up being a complete rewrite fixing
a lot of other bugs and minor problems and also implementing a cleaner architecture.

This plugin keeps track of all your commands until a successful response is received
from the lamp. It implements [exponential backoff](https://en.wikipedia.org/wiki/Exponential_backoff) to retry commands to which no response was received or a failure
was reported by the lamp.

It also keeps track of known lamps and will continue to ocasionally look for them if
they suddenly disappear. This is useful when you accidentally power off a lamp and
later turn it on.

## Bugs and feature requests

Please report any issues you might find, on [GitHub](https://github.com/vieira/homebridge-yeelight-wifi/issues).

Feature requests and specially pull requests are very welcome.
