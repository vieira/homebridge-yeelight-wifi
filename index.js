const fs = require('fs');
const YeePlatform = require('./platform');

module.exports = (homebridge) => {
  global.Accessory = homebridge.platformAccessory;
  global.Service = homebridge.hap.Service;
  global.Characteristic = homebridge.hap.Characteristic;
  global.UUIDGen = homebridge.hap.uuid;
  global.EOL = '\r\n';

  const configPath = homebridge.user.configPath();
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    const platforms = config.platforms || [];
    if (!platforms.find(({ platform }) => platform === 'yeelight')) return;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // eslint-disable-next-line no-console
      console.error(err.message);
    }
  }

  homebridge.registerPlatform(
    'homebridge-yeelight',
    'yeelight',
    YeePlatform,
    true,
  );
};
