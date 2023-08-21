const Temperature = (Device) =>
  class extends Device {
    constructor(props, platform) {
      super(props, platform);
      this.temperature = props.ct;

      const { ColorTemperature } = global.Characteristic;

      (
        this.service.getCharacteristic(ColorTemperature) ||
        this.service.addOptionalCharacteristic(ColorTemperature)
      )
        .on('set', async (value, callback) => {
          try {
            /* In moonlight mode do not attempt to change the temperature
             * on device since it will switch it back to daylight mode
             */
            if (this.activeMode === 0) {
              await this.setTemperature(value);
              callback(null);
            } else {
              platform.log.debug(
                `Device ${this.did} activeMode is ${this.activeMode}. Skipping setting temperature in moonlight mode.`
              );
              callback(null);
            }
          } catch (err) {
            callback(err);
          }
        })
        .setProps({
          minValue: 154, // ~6500K
          maxValue: this.model.startsWith('bslamp') ? 588 : 370, // ~1700K or ~2700K
        })
        .updateValue(this.temperature);

      // Setup the adaptive lighting controller if available
      if (
        platform.api.versionGreaterOrEqual &&
        platform.api.versionGreaterOrEqual('1.3.0-beta.23')
      ) {
        this.alController = new platform.api.hap.AdaptiveLightingController(
          this.service
        );
        this.accessory.configureController(this.alController);
      }
    }

    get temperature() {
      return this._temperature;
    }

    set temperature(kelvin) {
      this._temperature = Math.floor(10 ** 6 / Number(kelvin));
    }

    async setTemperature(mired) {
      const { temperature: transition = 400 } = this.config.transitions || {};
      const kelvin = 10 ** 6 / mired;
      const req = {
        method: 'set_ct_abx',
        params: [kelvin, 'smooth', transition],
      };
      return this.sendCmd(req).then(() => {
        this._temperature = mired;
      });
    }

    updateStateFromProp(prop, value) {
      if (prop === 'ct') {
        this.temperature = value;
        this.service
          .getCharacteristic(global.Characteristic.ColorTemperature)
          .updateValue(this.temperature);
        return;
      }
      super.updateStateFromProp(prop, value);
    }
  };

module.exports = Temperature;
