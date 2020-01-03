const Temperature = ({ ct }) => Device =>
  class extends Device {
    constructor(props, platform) {
      super(props, platform);
      this.temperature = ct;

      const { ColorTemperature } = global.Characteristic;

      (
        this.service.getCharacteristic(ColorTemperature) ||
        this.service.addOptionalCharacteristic(ColorTemperature)
      )
        .on('set', async (value, callback) => {
          try {
            await this.setTemperature(value);
            callback(null, value);
          } catch (err) {
            callback(err, this.temperature);
          }
        })
        .setProps({
          minValue: 154, // ~6500K
          maxValue: this.model.startsWith('bslamp') ? 588 : 370, // ~1700K or ~2700K
        })
        .updateValue(this.temperature);
    }

    get temperature() {
      return this._temperature - 1;
    }

    set temperature(kelvin) {
      this._temperature = 10 ** 6 / Number(kelvin);
    }

    async setTemperature(mired) {
      const { temperature: transition = 1500 } = this.config.transitions || {};
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
