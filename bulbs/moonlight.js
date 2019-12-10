const { name } = require('../utils');

/** Support for "moonlight" mode for ceiling lamps
 * active_mode:
 *  0 - Daylight mode |
 *  1 - Moonlight mode
 */

// eslint-disable-next-line max-len
const MoonlightMode = ({ bright: b, active_mode: activeMode = 0 }) => Device => class extends Device {
  constructor(did, model, platform) {
    super(did, model, platform);
    this.bright = b;
    this.activeMode = activeMode;
  }

  async setMoonlightMode(state) {
    const { brightness: transition = 400 } = this.config.transitions || {};
    this.log(`Setting ${state ? '🌙' : '☀️'} mode on device ${this.did}`);
    await this.sendCmd({
      method: 'set_power',
      params: [
        'on',
        'smooth',
        transition,
        state ? 5 : 1,
      ],
    });
    this.activeMode = state ? 1 : 0;
  }

  updateStateFromProp(prop, value) {
    if (prop === 'active_mode') {
      this.activeMode = value;
      this.moonlightModeService
        .getCharacteristic(global.Characteristic.On)
        .updateValue(this.activeMode === 1);
      return;
    }

    super.updateStateFromProp(prop, value);
  }

  configureServices() {
    const deviceId = this.did.slice(-6);
    const deviceName = name(deviceId, this.config);
    super.configureServices();

    this.moonlightModeService = this.accessory.getService(global.Service.Switch)
      || this.accessory.addService(new global.Service.Switch(`${deviceName} Moonlight Mode`));

    this.moonlightModeService.getCharacteristic(global.Characteristic.On)
      .on('set', async (value, callback) => {
        try {
          await this.setMoonlightMode(value);
          callback(null, this.activeMode);
        } catch (err) {
          callback(err, this.activeMode);
        }
      }).on('get', async (callback) => {
        try {
          const [value] = await this.getProperty(['active_mode']);
          this.activeMode = value;
          callback(null, this.activeMode);
        } catch (err) {
          callback(err, this.activeMode);
        }
      }).updateValue(this.activeMode);
  }
};

module.exports = MoonlightMode;
