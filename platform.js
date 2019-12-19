const dgram = require('dgram');
const YeeBulb = require('./bulbs/bulb');
const Brightness = require('./bulbs/brightness');
const MoonlightMode = require('./bulbs/moonlight');
const Color = require('./bulbs/color');
const Temperature = require('./bulbs/temperature');
const { name, blacklist, sleep, pipe } = require('./utils');

const MODELS = {
  MONO: 'mono', // Color Temperature Bulb
  COLOR: 'color', // RGB Bulb
  STRIPE: 'stripe', // LED Stripe
  CEILING: 'ceiling', // Ceiling lights
  BSLAMP: 'bslamp', // Bed side lamp
  LAMP: 'lamp', // Star Lamp etc.
};

class YeePlatform {
  constructor(log, config, api) {
    if (!api) return;
    log.debug(`starting YeePlatform using homebridge API v${api.version}`);

    this.searchMessage = Buffer.from(
      ['M-SEARCH * HTTP/1.1', 'MAN: "ssdp:discover"', 'ST: wifi_bulb'].join(
        global.EOL
      )
    );
    this.addr = '239.255.255.250';
    this.port = 1982;
    this.log = log;
    this.config = config;
    this.sock = dgram.createSocket('udp4');
    this.devices = {};

    this.sock.bind(this.port, () => {
      this.sock.setBroadcast(true);
      this.sock.setMulticastTTL(128);
      this.sock.addMembership(this.addr);
      const multicastInterface =
        config && config.multicast && config.multicast.interface;
      if (multicastInterface) {
        this.sock.setMulticastInterface(multicastInterface);
      }
    });

    this.api = api;
    this.api.on('didFinishLaunching', async () => {
      this.sock.on('message', this.handleMessage.bind(this));
      do {
        log.debug('doing a round of proactive search for known devices.');
        this.search();
        // eslint-disable-next-line no-await-in-loop
        await sleep(15000);
      } while (Object.values(this.devices).some(x => !x.reachable));

      log.debug('all known devices found, stopping proactive search.');
    });
  }

  configureAccessory(accessory) {
    this.log.debug(`remembered device ${accessory.displayName}.`);
    accessory.reachable = false;
    this.devices[accessory.context.did] = accessory;
  }

  search() {
    this.sock.send(
      this.searchMessage,
      0,
      this.searchMessage.length,
      this.port,
      this.addr
    );
  }

  handleMessage(message) {
    const headers = {};
    const [method, ...kvs] = message.toString().split(global.EOL);

    if (method.startsWith('M-SEARCH')) return;

    kvs.forEach(kv => {
      const [k, v] = kv.split(': ');
      headers[k] = v;
    });
    const endpoint = headers.Location.split('//')[1];
    this.log.debug(`received advertisement from ${headers.id.slice(-6)}.`);
    this.buildDevice(endpoint, headers);
  }

  buildDevice(endpoint, { id, model, support, ...props }) {
    const deviceId = id.slice(-6);
    const hidden = blacklist(deviceId, this.config);
    const features = support
      .split(' ')
      .concat(Object.keys(props))
      .filter(f => !hidden.includes(f));
    let accessory = this.devices[id];
    const mixins = [];

    if (!accessory) {
      const uuid = global.UUIDGen.generate(id);
      accessory = new global.Accessory(name(deviceId, this.config), uuid);
      accessory.context.did = id;
      accessory.context.model = model;
      this.devices[id] = accessory;
      this.api.registerPlatformAccessories('homebridge-yeelight', 'yeelight', [
        accessory,
      ]);
    }

    if (accessory.reachable) return;

    const family = Object.values(MODELS).find(fam => model.startsWith(fam));

    // Lamps that support moonlight mode
    if ([MODELS.CEILING, MODELS.LAMP].includes(family)) {
      this.log.debug(`device ${accessory.displayName} supports moonlight mode`);
      mixins.push(MoonlightMode(props));
    }

    if (features.includes('set_bright')) {
      this.log.debug(`device ${accessory.displayName} supports brightness`);
      mixins.push(Brightness(props));
    }

    if (features.includes('set_hsv')) {
      this.log.debug(`device ${accessory.displayName} supports color`);
      mixins.push(Color(props));
    }

    if (features.includes('set_ct_abx')) {
      this.log.debug(
        `device ${accessory.displayName} supports color temperature`
      );
      mixins.push(Temperature(props));
    }

    const Bulb = class extends pipe(...mixins)(YeeBulb) {};
    const device = new Bulb(id, model, this);
    device.accessory = accessory;
    device.endpoint = endpoint;
    device.configureServices();
    accessory.updateReachability(true);
    this.log(`initialized device ${accessory.displayName} (${device.host}).`);
  }
}

module.exports = YeePlatform;
