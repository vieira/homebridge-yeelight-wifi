const BacklightBrightness = (Device) =>
  class extends Device {
    constructor(props, platform) {
      super(props, platform);
      this.backlightBright = props['bg_bright'];

      const { Brightness } = global.Characteristic;

      (
        this.backlightService.getCharacteristic(Brightness) ||
        this.backlightService.addCharacteristic(Brightness)
      )
        .on('set', async (value, callback) => {
          try {
            await this.setBacklightBrightness(value);
            callback(null);
          } catch (err) {
            callback(err);
          }
        })
        .updateValue(this.backlightBright);
    }

    get backlightBright() {
      return this._backlightBright;
    }

    set backlightBright(brightness) {
      this._backlightBright = Number(brightness);
    }

    async setBacklightBrightness(brightness) {
      const { brightness: transition = 400 } = this.config.transitions || {};
      await this.setBacklightPower(true);
      const req = {
        method: 'bg_set_bright',
        params: [Math.max(brightness, 1), 'smooth', transition],
      };
      return this.sendCmd(req).then(() => {
        this._backlightBright = brightness;
      });
    }

    updateStateFromProp(prop, value) {
      if (prop === 'bg_bright') {
        this.backlightBright = value;
        this.backlightService
          .getCharacteristic(global.Characteristic.Brightness)
          .updateValue(this.backlightBright);
        return;
      }
      super.updateStateFromProp(prop, value);
    }
  };

module.exports = BacklightBrightness;
