const Backlight = (Device) =>
  class extends Device {
    constructor(props, platform) {
      super(props, platform);

      const { Lightbulb } = global.Service;

      this.backlightService =
        this.accessory.getService('backlight') ||
        this.accessory.addService(new Lightbulb(this.name, 'backlight'));

      this.backlightService
        .getCharacteristic(global.Characteristic.On)
        .on('set', async (value, callback) => {
          try {
            await this.setBacklightPower(value);
            callback(null);
          } catch (err) {
            callback(err);
          }
        })
        .on('get', async (callback) => {
          try {
            const [value] = await this.getProperty(['bg_power']);
            this.backlightPower = value;
            callback(null, this.backlightPower);
          } catch (err) {
            callback(err, this.backlightPower);
          }
        })
        .updateValue(this.backlightPower);
    }

    get backlightPower() {
      return !!this._backlightPower;
    }

    set backlightPower(state) {
      this._backlightPower = state === 'on' ? true : false;
    }

    updateStateFromProp(prop, value) {
      if (prop === 'bg_power') {
        this.backlightPower = value;
        this.backlightService
          .getCharacteristic(global.Characteristic.On)
          .updateValue(this.backlightPower);
      }
      super.updateStateFromProp(prop, value);
    }

    async setBacklightPower(backlightPower) {
      if (this.backlightPower === backlightPower) {
        return backlightPower;
      }
      const { power: transition = 400 } = this.config.transitions || {};
      const state = backlightPower ? 'on' : 'off';
      const req = {
        method: 'bg_set_power',
        params: [state, 'smooth', transition],
      };
      await this.sendCmd(req);
      this.backlightPower = state;
    }
  };

module.exports = Backlight;
