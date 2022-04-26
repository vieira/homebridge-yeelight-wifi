const Brightness = Device =>
  class extends Device {
    constructor(props, platform) {
      super(props, platform);
      this.bright = props.bright;

      (
        this.service.getCharacteristic(global.Characteristic.Brightness) ||
        this.service.addCharacteristic(global.Characteristic.Brightness)
      )
        .on('set', async (value, callback) => {
          try {
            await this.setBrightness(value);
            callback(null);
          } catch (err) {
            callback(err);
          }
        })
        .updateValue(this.bright);
    }

    get bright() {
      return this._bright;
    }

    set bright(bright) {
      this._bright = Number(bright);
    }

    async setBrightness(brightness) {
      const { brightness: transition = 400 } = this.config.transitions || {};
      await this.setPower(1);
      const req = {
        method: 'set_bright',
        params: [Math.max(brightness, 1), 'smooth', transition],
      };
      return this.sendCmd(req).then(() => {
        this._bright = brightness;
      });
    }

    updateStateFromProp(prop, value) {
      // There are different props being used for brightness
      // depending on the active_mode in Ceiling lamps
      if (
        (this.activeMode === 0 && prop === 'bright') ||
        (this.activeMode === 1 && prop === 'nl_br')
      ) {
        this.bright = value;
        this.service
          .getCharacteristic(global.Characteristic.Brightness)
          .updateValue(this.bright);
        return;
      }
      super.updateStateFromProp(prop, value);
    }
  };

module.exports = Brightness;
