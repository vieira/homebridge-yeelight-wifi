const YeeWhite = require('./white');

class YeeColor extends YeeWhite {
  constructor(did, model, platform) {
    super(did, model, platform);
    this.transitions.color = this.transitions.color || 1500;
    this.setColor = YeeColor.setColor();
  }

  get hue() {
    return this._hue;
  }

  set hue(hue) {
    this._hue = Number(hue);
  }

  get sat() {
    return this._sat;
  }

  set sat(sat) {
    this._sat = Number(sat);
  }

  configureServices() {
    super.configureServices();

    const lightbulbService =
          this.accessory.getService(global.Service.Lightbulb);

    (lightbulbService.getCharacteristic(global.Characteristic.Hue)
    || lightbulbService.addCharacteristic(global.Characteristic.Hue))
      .on('set', async (value, callback) => {
        try {
          await this.setColor(value, null);
          callback(null, this.hue);
        } catch (err) {
          callback(err, this.hue);
        }
      }).updateValue(this.hue);

    (lightbulbService.getCharacteristic(global.Characteristic.Saturation)
    || lightbulbService.addCharacteristic(global.Characteristic.Saturation))
      .on('set', async (value, callback) => {
        try {
          await this.setColor(null, value);
          callback(null, this.sat);
        } catch (err) {
          callback(err, this.sat);
        }
      }).updateValue(this.sat);
  }

  static setColor() {
    let hue = null;
    let sat = null;
    return function (h, s) {
      hue = hue !== null ? hue : h;
      sat = sat !== null ? sat : s;
      if (hue === null || sat === null) return Promise.resolve();
      this.setPower(1);
      const req = {
        method: 'set_hsv',
        params: [
          hue,
          sat,
          'smooth',
          this.transitions.color,
        ],
      };
      return this.sendCmd(req).then(() => {
        this._hue = hue;
        this._sat = sat;
        hue = null;
        sat = null;
      });
    };
  }
}

module.exports = YeeColor;
