const dgram = require('dgram');
const YeeBulb = require('./bulbs/bulb');
const Brightness = require('./bulbs/brightness');
const MoonlightMode = require('./bulbs/moonlight');
const Color = require('./bulbs/color');
const Temperature = require('./bulbs/temperature');
const { getDeviceId, getName, blacklist, sleep, pipe } = require('./utils');

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
      log(`Searching for known devices...`);
      do {
        this.search();
        // eslint-disable-next-line no-await-in-loop
        await sleep(15000);
      } while (
        Object.values(this.devices).some(accessory => !accessory.initialized)
      );

      log(`All known devices found. Stopping proactive search.`);
    });
  }

  configureAccessory(accessory) {
    this.log(`Loaded accessory ${accessory.displayName}.`);
    accessory.initialized = false;
    this.devices[accessory.context.did] = accessory;
  }

  search() {
    this.log('Sending search request...');
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
    this.log(`Received advertisement from ${getDeviceId(headers.id)}.`);
    this.buildDevice(endpoint, headers);
  }

  buildDevice(endpoint, { id, model, support, ...props }) {
    const deviceId = getDeviceId(id);
    const hidden = blacklist(deviceId, this.config);
    const features = support
      .split(' ')
      .concat(Object.keys(props))
      .filter(f => !hidden.includes(f));

    let accessory = this.devices[id];

    const name = getName(`${model}-${getDeviceId(id)}`, this.config);

    if (!accessory) {
      this.log(`Initializing new accessory ${id} with name ${name}...`);
      const uuid = global.UUIDGen.generate(id);
      accessory = new global.Accessory(name, uuid);
      accessory.context.did = id;
      accessory.context.model = model;
      this.devices[id] = accessory;
      this.api.registerPlatformAccessories('homebridge-yeelight', 'yeelight', [
        accessory,
      ]);
    }

    if (accessory && accessory.initialized) return;

    const mixins = [];
    const family = Object.values(MODELS).find(fam => model.startsWith(fam));

    // Lamps that support moonlight mode
    if ([MODELS.CEILING, MODELS.LAMP].includes(family)) {
      this.log(`Device ${name} supports moonlight mode`);
      mixins.push(MoonlightMode);
    }

    if (features.includes('set_bright')) {
      this.log(`Device ${name} supports brightness`);
      mixins.push(Brightness);
    }

    if (features.includes('set_hsv')) {
      this.log(`Device ${name} supports color`);
      mixins.push(Color);
    }

    if (features.includes('set_ct_abx')) {
      this.log(`Device ${name} supports color temperature`);
      mixins.push(Temperature);
    }

    const Bulb = class extends pipe(...mixins)(YeeBulb) {};
    return new Bulb({ id, name, model, endpoint, accessory, ...props }, this);
  }
}

module.exports = YeePlatform;
