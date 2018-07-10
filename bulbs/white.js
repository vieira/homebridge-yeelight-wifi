const net = require('net');
const { id, fromYeeToHk } = require('../utils');

class YeeWhite {
  constructor(did, model, platform) {
    this.did = did;
    this.model = model;
    this.log = platform.log;
    this.cmds = {};
    this.sock = null;
    this.accessory = null;
    this.timeout = null;
    this.config = platform.config;
    this.transitions = platform.config && platform.config.transitions;
    this.transitions = {
      power: (this.transitions && this.transitions.power) || 400,
      brightness: (this.transitions && this.transitions.brightness) || 400,
    };
  }

  get endpoint() {
    return `${this.host}:${this.port}`;
  }

  set endpoint(endpoint) {
    const [host, port] = endpoint.split(':');
    this.host = host;
    this.port = Number(port);
  }

  get power() {
    return this._power;
  }

  set power(state) {
    this._power = (state === 'on') ? 1 : 0;
  }

  get bright() {
    return this._bright;
  }

  set bright(bright) {
    this._bright = Number(bright);
  }

  configureServices() {
    const deviceId = this.did.slice(-6);
    const name = (
      this.config &&
      this.config.defaultValue &&
      this.config.defaultValue[deviceId] &&
      this.config.defaultValue[deviceId].name) || deviceId;
    this.accessory.getService(global.Service.AccessoryInformation)
      .setCharacteristic(global.Characteristic.Manufacturer, 'YeeLight')
      .setCharacteristic(global.Characteristic.Model, this.model)
      .setCharacteristic(global.Characteristic.SerialNumber, this.host);

    this.accessory.on('identify', async (_, callback) => {
      await this.identify();
      callback();
    });

    const lightbulbService = this.accessory.getService(global.Service.Lightbulb)
    || this.accessory.addService(new global.Service.Lightbulb(name));

    lightbulbService.getCharacteristic(global.Characteristic.On)
      .on('set', async (value, callback) => {
        try {
          await this.setPower(value);
          callback(null, value);
        } catch (err) {
          callback(err, this.power);
        }
      }).on('get', async (callback) => {
        try {
          const [value] = await this.getProperty(['power']);
          this.power = value;
          callback(null, this.power);
        } catch (err) {
          callback(err, this.power);
        }
      }).updateValue(this.power);

    (lightbulbService.getCharacteristic(global.Characteristic.Brightness)
    || lightbulbService.addCharacteristic(global.Characteristic.Brightness))
      .on('set', async (value, callback) => {
        try {
          await this.setBrightness(value);
          callback(null, value);
        } catch (err) {
          callback(err, this.bright);
        }
      }).updateValue(this.bright);
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.sock && !this.sock.destroyed) {
        resolve();
        return;
      }

      this.sock = net.connect(this.port, this.host, () => {
        this.log(`💡  connected to ${this.host}.`);
        resolve();
      });

      this.sock.on('data', this.processMessages([
        this.resultHandler.bind(this),
        this.notificationHandler.bind(this),
      ]));

      this.sock.on('error', (error) => {
        this.log('error', `${this.host}: ${error.message}.`);
        reject(error.code);
      });

      this.sock.on('close', (hadError) => {
        this.log('warn', `${this.host} closed. error? ${hadError}.`);
        this.cmds = {};
        reject(new Error(`close: error? ${hadError}`));
      });
    });
  }

  setPower(power) {
    if (this.power === power) {
      return Promise.resolve(power);
    }
    const state = power ? 'on' : 'off';
    const req = {
      method: 'set_power',
      params: [
        state,
        'smooth',
        this.transitions.power,
      ],
    };
    return this.sendCmd(req).then(() => { this._power = power; });
  }

  setBrightness(brightness) {
    const req = {
      method: 'set_bright',
      params: [
        Math.max(brightness, 1),
        'smooth',
        this.transitions.brightness,
      ],
    };
    return this.sendCmd(req).then(() => { this._bright = brightness; });
  }

  getProperty(properties) {
    const req = { method: 'get_prop', params: properties };
    return this.sendCmd(req);
  }

  identify() {
    const req = { method: 'toggle', params: [] };
    return this.sendCmd(req);
  }

  async sendCmd(cmd, retries = 5, duration = 100) {
    cmd.id = id.next().value;
    for (let i = 0; i <= retries; i += 1) {
      const t = duration << i;
      try {
        // await in loop intentionally used to implement exponential backoff
        // eslint-disable-next-line no-await-in-loop
        return await this._sendCmd(cmd, t);
      } catch (err) {
        this.log('warn', `failed attempt ${i} after ${t}ms.`);
        if (err === 'EHOSTUNREACH') break;
      }
    }
    this.sock.destroy();
    this.log('error', `failed to send cmd ${cmd.id} after ${retries} retries.`);
    return Promise.reject(new Error(`${cmd.id}`));
  }

  _sendCmd(cmd, duration) {
    return new Promise(async (resolve, reject) => {
      if (!this.sock || this.sock.destroyed) {
        try { await this.connect(); } catch (err) { reject(err); }
      }
      const msg = JSON.stringify(cmd);
      const timeout = setTimeout(() => {
        reject(new Error(`${cmd.id}`));
        delete this.cmds[cmd.id];
      }, duration);
      this.sock.write(msg + global.EOL);
      this.cmds[cmd.id] = { resolve, reject, timeout };
      this.log(`${msg}`);
    });
  }

  processMessages(handlers = []) {
    return (messages) => {
      messages.toString().split(global.EOL)
        .filter(it => it)
        .map(payload => JSON.parse(payload))
        .forEach((message) => {
          handlers.find(handler => handler(this, message));
        });
    };
  }

  resultHandler(device, message) {
    if (!('id' in message)) return false;
    if (!(message.id in this.cmds)) return true;

    const cmd = this.cmds[message.id];
    clearTimeout(cmd.timeout);

    if ('result' in message) {
      this.log(message);
      cmd.resolve(message.result);
    } else if ('error' in message) {
      this.log('error', message);
      cmd.reject(message.error.message);
    } else {
      this.log('error', `unexpected result from ${device.host}: ${message}`);
      cmd.reject(message.error.message);
    }
    delete this.cmds[message.id];
    return true;
  }

  notificationHandler(device, message) {
    if (!('method' in message && message.method === 'props')) {
      return false;
    }

    const lightbulbService =
      device.accessory.getService(global.Service.Lightbulb);

    Object.keys(message.params).forEach((param) => {
      const { value, characteristic } =
      fromYeeToHk(this, param, message.params[param]);
      lightbulbService.getCharacteristic(characteristic).updateValue(value);
    });
    return true;
  }
}

module.exports = YeeWhite;
