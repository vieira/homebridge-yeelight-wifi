const COLOR_FLOW_DISABLED = 0;
const COLOR_FLOW_ENABLED = 1;

const ColorFlowMode = (Device) =>
  class extends Device {
    constructor(props, platform) {
      super(props, platform);
      this.initColorFlow();
    }

    async initColorFlow() {
      const [flowing] = await this.getProperty(['flowing']);
      if (!flowing) return;

      this.log(`Device ${this.name} supports color flow mode`);
      this.flowing = Number(flowing) || COLOR_FLOW_DISABLED;

      this.colorFlowService =
        this.accessory.getService(global.Service.Switch) ||
        this.accessory.addService(new global.Service.Switch(`Color Flow Mode`));

      this.colorFlowService
        .getCharacteristic(global.Characteristic.On)
        .on('set', async (value, callback) => {
          try {
            await this.setColorFlowMode(value);
            callback(null);
          } catch (err) {
            callback(err);
          }
        })
        .on('get', async (callback) => {
          try {
            const [value] = await this.getProperty(['flowing']);
            this.flowing = Number(value);
            callback(null, this.flowing);
          } catch (err) {
            callback(err, this.flowing);
          }
        })
        .updateValue(this.flowing);
    }

    async setColorFlowMode(state) {
      const { brightness: transition = 400 } = this.config.transitions || {};
      this.log.debug(
        `${state ? 'Enabling' : 'Disabling'} color flow mode on device ${this.did}`
      );
      await this.sendCmd({
        method: 'set_power',
        params: ['on', 'smooth', transition, state ? 4 : 1],
      });
      this.flowing = state ? COLOR_FLOW_ENABLED : COLOR_FLOW_DISABLED;
    }

    updateStateFromProp(prop, value) {
      if (prop === 'flowing') {
        this.flowing = value;
        this.colorFlowService
          .getCharacteristic(global.Characteristic.On)
          .updateValue(this.flowing === COLOR_FLOW_ENABLED);
        return;
      }

      super.updateStateFromProp(prop, value);
    }
  };

module.exports = ColorFlowMode;
