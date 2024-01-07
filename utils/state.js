const fs = require('fs');

class stateDB {
  constructor() {
    this.state = {};
    this.path;
  }

  init(path) {
    this.path = path;
    try {
      fs.accessSync(path, fs.constants.F_OK);
      this.state = JSON.parse(fs.readFileSync(path));
    } catch (e) {
      this.state = {};
    }
  }

  getValue(key, value = null) {
    return this.state[key] ? this.state[key] : value;
  }

  has(key) {
    return this.state[key] != undefined;
  }

  setValue(key, value) {
    this.state[key] = value;
    fs.writeFileSync(this.path, JSON.stringify(this.state, null, '\t'));
  }
}

module.exports = new stateDB();
