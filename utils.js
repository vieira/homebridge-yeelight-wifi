const id = ((function* () {
  let i = 0;
  while (true) {
    yield i += 1;
  }
})());

const sleep = duration => new Promise((resolve) => {
  setTimeout(() => resolve(), duration);
});

const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);

const name = (devId, config) => (
  (config
    && config.defaultValue
    && config.defaultValue[devId]
    && config.defaultValue[devId].name)
  || devId
);

const blacklist = (devId, config) => (
  (config
    && config.defaultValue
    && config.defaultValue[devId]
    && config.defaultValue[devId].blacklist)
  || []
);

const handle = (handlers = []) => (messages) => {
  messages.toString().split(global.EOL)
    .filter(it => it)
    .map(payload => JSON.parse(payload))
    .forEach((message) => {
      handlers.find(handler => handler(message));
    });
};

module.exports = {
  id,
  name,
  blacklist,
  handle,
  sleep,
  pipe,
};
