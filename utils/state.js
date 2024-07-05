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

  getValue(table, key) {
    if (!this.state[table]) {
      return null;
    } else {
      return this.state[table][key] ? this.state[table][key] : null;
    }
  }

  getTable(table) {
    // return this.state[table]? this.state[table]: {};
    return this.state[table];
  }

  has(table, key) {
    if (!this.state[table]) {
      return false;
    }
    return this.state[table][key] != undefined;
  }

  setValue(table, key, value) {
    if (!this.state[table]) {
      this.state[table] = {};
    }
    this.state[table][key] = value;
    fs.writeFileSync(this.path, JSON.stringify(this.state, null, '\t'));
  }

  deleteValue(table, key) {
    delete this.state[table][key];
    fs.writeFileSync(this.path, JSON.stringify(this.state, null, '\t'));
  }
}

module.exports = new stateDB();
