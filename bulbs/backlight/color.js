const { isInteger } = Number;

const BacklightColor = (Device) => {
  let hue;
  let sat;

  return class extends Device {
    constructor(props, platform) {
      super(props, platform);
      this.backlightHue = props['bg_hue'];
      this.backlightSat = props['bg_sat'];

      const { Hue, Saturation } = global.Characteristic;

      (
        this.backlightService.getCharacteristic(Hue) ||
        this.backlightService.addCharacteristic(Hue)
      )
        .on('set', async (value, callback) => {
          try {
            await this.setBacklightColor(value, null);
            callback(null);
          } catch (err) {
            callback(err);
          }
        })
        .updateValue(this.backlightHue);

      (
        this.backlightService.getCharacteristic(Saturation) ||
        this.backlightService.addCharacteristic(Saturation)
      )
        .on('set', async (value, callback) => {
          try {
            await this.setBacklightColor(null, value);
            callback(null);
          } catch (err) {
            callback(err);
          }
        })
        .updateValue(this.backlightSat);
    }

    get backlightHue() {
      return this._backlightHue;
    }

    set backlightHue(value) {
      this._backlightHue = Number(value);
    }

    get backlightSat() {
      return this._backlightSat;
    }

    set backlightSat(value) {
      this._backlightSat = Number(value);
    }

    updateStateFromProp(prop, value) {
      if (prop === 'bg_hue') {
        this.backlightHue = value;
        this.backlightService
          .getCharacteristic(global.Characteristic.Hue)
          .updateValue(this.backlightHue);
        return;
      }
      if (prop === 'bg_sat') {
        this.backlightSat = value;
        this.backlightService
          .getCharacteristic(global.Characteristic.Saturation)
          .updateValue(this.backlightSat);
        return;
      }
      if (prop === 'bg_rgb') {
        return;
      }
      super.updateStateFromProp(prop, value);
    }

    async setBacklightColor(hv, sv) {
      hue = isInteger(hue) ? hue : hv;
      sat = isInteger(sat) ? sat : sv;
      if (!isInteger(hue) || !isInteger(sat)) return;

      const { color: transition = 400 } = this.config.transitions || {};
      await this.setBacklightPower(true);
      const req = {
        method: 'bg_set_hsv',
        params: [hue, sat, 'smooth', transition],
      };
      return this.sendCmd(req).then(() => {
        this._backlightHue = hue;
        this._backlightSat = sat;
        hue = null;
        sat = null;
      });
    }
  };
};

module.exports = BacklightColor;
