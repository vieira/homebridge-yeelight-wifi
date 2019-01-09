const Brightness = ({ bright: b }) => Device => class extends Device {
  constructor(did, model, platform) {
    super(did, model, platform);
    this.bright = b;
  }

  get bright() {
    return this._bright;
  }

  set bright(bright) {
    this._bright = Number(bright);
  }

  setBrightness(brightness) {
    const { brightness: transition = 400 } = this.config.transitions || {};
    const req = {
      method: 'set_bright',
      params: [
        Math.max(brightness, 1),
        'smooth',
        transition,
      ],
    };
    return this.sendCmd(req).then(() => { this._bright = brightness; });
  }

  updateStateFromProp(prop, value) {
    if (prop === 'bright') {
      this.bright = value;
      this.service
        .getCharacteristic(global.Characteristic.Brightness)
        .updateValue(this.bright);
      return;
    }
    super.updateStateFromProp(prop, value);
  }

  configureServices() {
    super.configureServices();

    (this.service.getCharacteristic(global.Characteristic.Brightness)
    || this.service.addCharacteristic(global.Characteristic.Brightness))
      .on('set', async (value, callback) => {
        try {
          await this.setBrightness(value);
          callback(null, value);
        } catch (err) {
          callback(err, this.bright);
        }
      }).updateValue(this.bright);
  }
};

module.exports = Brightness;
