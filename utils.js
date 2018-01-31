const id = ((function* () {
  let i = 0;
  while (true) {
    yield i += 1;
  }
})());

const sleep = duration => new Promise((resolve) => {
  setTimeout(() => resolve(), duration);
});

const fromYeeToHk = (device, property, value = 0) => {
  switch (property) {
    case 'power':
      device.power = value;
      return {
        value: device.power,
        characteristic: global.Characteristic.On,
      };
    case 'bright':
      device.bright = value;
      return {
        value: device.bright,
        characteristic: global.Characteristic.Brightness,
      };
    case 'sat':
      device.sat = value;
      return {
        value: device.sat,
        characteristic: global.Characteristic.Saturation,
      };
    case 'hue':
      device.hue = value;
      return {
        value: device.hue,
        characteristic: global.Characteristic.Hue,
      };
    default:
      device.log(
        'info',
        `${property} is unsupported in Homekit, ignoring.`,
      );
      // Return something conservative
      return {
        value: device.power,
        characteristic: global.Characteristic.On,
      };
  }
};

module.exports = { id, sleep, fromYeeToHk };
