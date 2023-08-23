const { colorFromTemperature } = require('../utils');

const Temperature = (Device) =>
  class extends Device {
    constructor(props, platform) {
      super(props, platform);
      this.temperature = props.ct;
      this.controller = {};

      const { ColorTemperature } = global.Characteristic;
      const [minValue, maxValue] = props.limits.colorTemperature;

      (
        this.service.getCharacteristic(ColorTemperature) ||
        this.service.addOptionalCharacteristic(ColorTemperature)
      )
        .on('set', async (value, callback) => {
          // In moonlight mode (1) do not attempt to change the temperature
          // since it would switch the device to daylight mode (0)
          if (this.activeMode === 1) {
            this.log.debug(
              `Device ${this.name} is in moonlight mode.`,
              'Skipping setting temperature.'
            );
            callback(null);
            return;
          }

          try {
            await this.setTemperature(value);
            callback(null);
          } catch (err) {
            callback(err);
          }
        })
        .setProps({ minValue, maxValue })
        .updateValue(this.temperature);

      // Setup the adaptive lighting controller if available
      this.configureAdaptiveLightingController(platform);
    }

    get temperature() {
      return this._temperature;
    }

    set temperature(kelvin) {
      this._temperature = Math.floor(10 ** 6 / Number(kelvin));
    }

    async setTemperature(mired) {
      // If we are already in color temperature mode (2) and the current
      // temperature matches the new temperature there is no need to send
      // another command.
      if (this.temperature === mired && this.colorMode === 2) return;

      // If we receive a direct command from the user to go to a certain color
      // temperature, turn on the device and go to that temperature.
      if (!this.controller.isAdaptiveLightingActive()) {
        await this.setPower(true);
      }

      // If the device is powered off there is no point in sending the command
      // as it will have no effect. Let's just update our internal state so
      // we can send the command when the device is powered on.
      if (!this.power) {
        this._temperature = mired;
        return;
      }

      const { temperature: transition = 400 } = this.config.transitions || {};
      const kelvin = 10 ** 6 / mired;
      const req = {
        method: 'set_ct_abx',
        params: [kelvin, 'smooth', transition],
      };

      return this.sendCmd(req).then(() => {
        this._temperature = mired;
        // After set_ct_abx runs the bulb will be in temperature color mode (2).
        this.colorMode = 2;

        // When adaptive lightning is enabled homebridge already takes care
        // of updating the color in HomeKit to match the current color temperature.
        //
        // However when we set the color temperature directly we have to do it
        // ourselves.
        if (!this.controller.isAdaptiveLightingActive()) {
          const { hue, sat } = colorFromTemperature(mired);
          super.updateStateFromProp('hue', hue);
          super.updateStateFromProp('sat', sat);
        }
      });
    }

    updateStateFromProp(prop, value) {
      switch (prop) {
        case 'ct':
          this.temperature = value;
          this.service
            .getCharacteristic(global.Characteristic.ColorTemperature)
            .updateValue(this.temperature);
          break;
        case 'color_mode':
          this.colorMode = value;
          break;
        default:
          super.updateStateFromProp(prop, value);
      }
    }

    configureAdaptiveLightingController(platform) {
      if (!platform.api.versionGreaterOrEqual) return;
      if (!platform.api.versionGreaterOrEqual('1.3.0-beta.23')) return;

      this.controller = new platform.api.hap.AdaptiveLightingController(
        this.service
      );
      this.accessory.configureController(this.controller);

      this.service
        .getCharacteristic(global.Characteristic.On)
        .on('change', ({ newValue, oldValue, reason }) => {
          if (reason !== 'write') return;
          if (!this.controller.isAdaptiveLightingActive()) return;
          if (!oldValue && newValue) {
            this.setTemperature(this._temperature--);
          }
        });
    }
  };

module.exports = Temperature;
