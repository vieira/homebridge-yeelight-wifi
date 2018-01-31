const YeePlatform = require('./platform');

module.exports = (homebridge) => {
  global.Accessory = homebridge.platformAccessory;
  global.Service = homebridge.hap.Service;
  global.Characteristic = homebridge.hap.Characteristic;
  global.UUIDGen = homebridge.hap.uuid;
  global.EOL = '\r\n';

  homebridge.registerPlatform(
    'homebridge-yeelight',
    'yeelight',
    YeePlatform,
    true,
  );
};
