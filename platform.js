const dgram = require('dgram');
const YeeWhite = require('./bulbs/white');
const YeeColor = require('./bulbs/color');
const { sleep } = require('./utils');

class YeePlatform {
  constructor(log, config, api) {
    if (!api) return;
    log(`starting YeePlatform using homebridge API v${api.version}`);

    this.searchMessage = Buffer.from([
      'M-SEARCH * HTTP/1.1',
      'MAN: "ssdp:discover"',
      'ST: wifi_bulb',
    ].join(global.EOL));
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
      const multicastInterface = config && config.multicast && config.multicast.interface;
      if (multicastInterface) {
        this.sock.setMulticastInterface(multicastInterface);
      }
    });

    this.api = api;
    this.api.on('didFinishLaunching', async () => {
      this.sock.on('message', this.handleMessage.bind(this));
      do {
        log('doing a round of proactive search for known devices.');
        this.search();
        // eslint-disable-next-line no-await-in-loop
        await sleep(15000);
      } while (Object.values(this.devices).some(x => !x.reachable));

      log('all known devices found, stopping proactive search.');
    });
  }

  configureAccessory(accessory) {
    this.log(`remembered device ${accessory.displayName}.`);
    accessory.reachable = false;
    this.devices[accessory.context.did] = accessory;
  }

  search() {
    this.sock.send(
      this.searchMessage,
      0,
      this.searchMessage.length,
      this.port,
      this.addr,
    );
  }

  handleMessage(message) {
    const headers = {};
    const [method, ...kvs] = message.toString().split(global.EOL);

    if (method.startsWith('M-SEARCH')) return;

    kvs.forEach((kv) => {
      const [k, v] = kv.split(': ');
      headers[k] = v;
    });
    const endpoint = headers.Location.split('//')[1];
    this.log(`received advertisement from ${headers.id.slice(-6)}.`);
    this.buildDevice(endpoint, headers);
  }

  buildDevice(
    endpoint,
    {
      id,
      model,
      power,
      bright,
      hue,
      sat,
      support,
    },
  ) {
    let accessory = this.devices[id];
    if (!accessory) {
      const uuid = global.UUIDGen.generate(id);
      const deviceId = id.slice(-6);
      const name = (
        this.config
        && this.config.defaultValue
        && this.config.defaultValue[deviceId]
        && this.config.defaultValue[deviceId].name
      ) || deviceId;
      accessory = new global.Accessory(name, uuid);
      accessory.context.did = id;
      accessory.context.model = model;
      this.devices[id] = accessory;
      this.api.registerPlatformAccessories(
        'homebridge-yeelight',
        'yeelight',
        [accessory],
      );
    }

    if (accessory.reachable) return;

    const YeeDevice = model === 'mono' ? YeeWhite : YeeColor;
    const device = new YeeDevice(id, model, support, this);
    device.accessory = accessory;
    device.endpoint = endpoint;
    device.power = power;
    device.bright = bright;
    device.hue = hue;
    device.sat = sat;
    device.configureServices();
    accessory.updateReachability(true);
    this.log(`initialized device ${accessory.displayName} (${device.host}).`);
  }
}

module.exports = YeePlatform;
