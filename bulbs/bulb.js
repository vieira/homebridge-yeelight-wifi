const net = require('net');
const { id, handle } = require('../utils');

class YeeBulb {
  constructor(props, platform) {
    const { id, model, name, endpoint, accessory } = props;
    this.did = id;
    this.model = model;
    this.log = platform.log;
    this.cmds = {};
    this.sock = null;
    this.accessory = accessory;
    this.activeMode = 0; // We need to set a default activeMode since it's being used in brightness.js
    this.config = platform.config || {};
    this.endpoint = endpoint;
    const { retries = 5, timeout = 100 } = this.config.connection || {};
    this.retries = retries;
    this.timeout = timeout;

    this.accessory
      .getService(global.Service.AccessoryInformation)
      .setCharacteristic(global.Characteristic.Manufacturer, 'YeeLight')
      .setCharacteristic(global.Characteristic.Model, this.model)
      .setCharacteristic(global.Characteristic.SerialNumber, this.did);

    this.service =
      this.accessory.getService(global.Service.Lightbulb) ||
      this.accessory.addService(new global.Service.Lightbulb(name));

    this.accessory.on('identify', async (_, callback) => {
      await this.identify();
      callback();
    });

    this.service
      .getCharacteristic(global.Characteristic.On)
      .on('set', async (value, callback) => {
        try {
          await this.setPower(value);
          callback(null);
        } catch (err) {
          callback(err);
        }
      })
      .on('get', async callback => {
        try {
          const [value] = await this.getProperty(['power']);
          this.power = value;
          callback(null, this.power);
        } catch (err) {
          callback(err, this.power);
        }
      })
      .updateValue(!!this.power);

    this.accessory.initialized = true;

    this.log(`Initialized device ${name} (${this.endpoint}).`);
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
    this._power = state === 'on' ? 1 : 0;
  }

  updateStateFromProp(prop, value) {
    if (prop !== 'power') {
      this.log.debug(`${prop} is not supported in Homekit, skipping.`);
      return;
    }
    this.power = value;
    this.service
      .getCharacteristic(global.Characteristic.On)
      .updateValue(this.power);
  }

  async setPower(power) {
    if (this.power === power) {
      return Promise.resolve(power);
    }
    const { power: transition = 400 } = this.config.transitions || {};
    const state = power ? 'on' : 'off';
    const req = {
      method: 'set_power',
      params: [state, 'smooth', transition],
    };
    await this.sendCmd(req);
    this._power = power;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.sock && !this.sock.destroyed) {
        resolve();
        return;
      }

      this.sock = net.connect(this.port, this.host, () => {
        this.log.debug(`connected to ${this.host}.`);
        resolve();
      });

      this.sock.on(
        'data',
        handle([this.responseHandler.bind(this), this.stateHandler.bind(this)])
      );

      this.sock.on('error', error => {
        this.log.error(`${this.host}: ${error.message}.`);
        reject(error.code);
      });

      this.sock.on('close', hadError => {
        this.log.warn(`${this.host} closed. error? ${hadError}.`);
        this.cmds = {};
        reject(new Error(`close: error? ${hadError}`));
      });
    });
  }

  getProperty(properties) {
    const req = { method: 'get_prop', params: properties };
    return this.sendCmd(req);
  }

  identify() {
    // Use flash notify effect when supported
    // TODO: Check support for `start_cf`
    const req = {
      method: 'start_cf',
      params: [10, 0, '500,2,0,10,500,2,0,100'],
    };
    return this.sendCmd(req);
  }

  async sendCmd(cmd) {
    this.log.info(`Sending command: ${JSON.stringify(cmd)}`)
    const { retries, timeout } = this;
    cmd.id = id.next().value;
    for (let i = 0; i <= retries; i += 1) {
      const t = timeout << i;
      try {
        // await in loop intentionally used to implement exponential backoff
        // eslint-disable-next-line no-await-in-loop
        return await this._sendCmd(cmd, t);
      } catch (err) {
        this.log.debug(
          `${this.did}: failed communication attempt ${i} after ${t}ms.`
        );
        if (err === 'EHOSTUNREACH') break;
      }
    }
    this.sock.destroy();
    this.log.error(
      `${this.did}: failed to send cmd ${cmd.id} after ${retries} retries.`
    );
    return Promise.reject(new Error(`${cmd.id}`));
  }

  _sendCmd(cmd, duration) {
    return new Promise(async (resolve, reject) => {
      if (!this.sock || this.sock.destroyed) {
        try {
          await this.connect();
        } catch (err) {
          reject(err);
        }
      }
      const msg = JSON.stringify(cmd);
      const timeout = setTimeout(() => {
        reject(new Error(`${cmd.id}`));
        delete this.cmds[cmd.id];
      }, duration);
      this.sock.write(msg + global.EOL);
      this.cmds[cmd.id] = { resolve, reject, timeout };
      this.log.debug(msg);
    });
  }

  responseHandler(message) {
    if (!('id' in message)) return false;
    if (!(message.id in this.cmds)) return true;

    const cmd = this.cmds[message.id];
    clearTimeout(cmd.timeout);

    if ('result' in message) {
      this.log.debug(message);
      cmd.resolve(message.result);
    } else if ('error' in message) {
      this.log.error(message);
      cmd.reject(message.error.message);
    } else {
      this.log.error(`unexpected result from ${this.host}: ${message}`);
      cmd.reject(message.error.message);
    }
    delete this.cmds[message.id];
    return true;
  }

  stateHandler(message) {
    if (!('method' in message && message.method === 'props')) {
      return false;
    }
    Object.keys(message.params).forEach(param => {
      this.updateStateFromProp(param, message.params[param]);
    });
    return true;
  }
}

module.exports = YeeBulb;
