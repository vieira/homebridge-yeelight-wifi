const { isInteger } = Number;

const Color = ({ hue: h, sat: s }) => Device => {
  let hue;
  let sat;

  return class extends Device {
    constructor(props, platform) {
      super(props, platform);
      this.hue = h;
      this.sat = s;

      const { Hue, Saturation } = global.Characteristic;

      (
        this.service.getCharacteristic(Hue) ||
        this.service.addCharacteristic(Hue)
      )
        .on('set', async (value, callback) => {
          try {
            await this.setColor(value, null);
            callback(null, this.hue);
          } catch (err) {
            callback(err, this.hue);
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
            callback(null, this.sat);
          } catch (err) {
            callback(err, this.sat);
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

    setColor(hv, sv) {
      hue = isInteger(hue) ? hue : hv;
      sat = isInteger(sat) ? sat : sv;
      if (!isInteger(hue) || !isInteger(sat)) return Promise.resolve();

      const { color: transition = 1500 } = this.config.transitions || {};
      this.setPower(1);
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
