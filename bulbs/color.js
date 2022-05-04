const { isInteger } = Number;

const Color = Device => {
  let hue;
  let sat;

  return class extends Device {
    constructor(props, platform) {
      super(props, platform);
      this.hue = props.hue;
      this.sat = props.sat;

      const { Hue, Saturation } = global.Characteristic;

      (
        this.service.getCharacteristic(Hue) ||
        this.service.addCharacteristic(Hue)
      )
        .on('set', async (value, callback) => {
          try {
            await this.setColor(value, null);
            callback(null);
          } catch (err) {
            callback(err);
          }
        })
        .updateValue(this.hue);

      (
        this.service.getCharacteristic(Saturation) ||
        this.service.addCharacteristic(Saturation)
      )
        .on('set', async (value, callback) => {
          try {
            await this.setColor(null, value);
            callback(null);
          } catch (err) {
            callback(err);
          }
        })
        .updateValue(this.sat);
    }

    get hue() {
      return this._hue;
    }

    set hue(value) {
      this._hue = Number(value);
    }

    get sat() {
      return this._sat;
    }

    set sat(value) {
      this._sat = Number(value);
    }

    updateStateFromProp(prop, value) {
      if (prop === 'hue') {
        this.hue = value;
        this.service
          .getCharacteristic(global.Characteristic.Hue)
          .updateValue(this.hue);
        return;
      }
      if (prop === 'sat') {
        this.sat = value;
        this.service
          .getCharacteristic(global.Characteristic.Saturation)
          .updateValue(this.sat);
        return;
      }
      if (prop === 'rgb') {
        return;
      }
      super.updateStateFromProp(prop, value);
    }

    async setColor(hv, sv) {
      hue = isInteger(hue) ? hue : hv;
      sat = isInteger(sat) ? sat : sv;
      if (!isInteger(hue) || !isInteger(sat)) return Promise.resolve();

      const { color: transition = 400 } = this.config.transitions || {};
      await this.setPower(1); // Commands can be dropped if bulb is not turned on first
      const req = {
        method: 'set_hsv',
        params: [hue, sat, 'smooth', transition],
      };
      return this.sendCmd(req).then(() => {
        this._hue = hue;
        this._sat = sat;
        hue = null;
        sat = null;
      });
    }
  };
};

module.exports = Color;
