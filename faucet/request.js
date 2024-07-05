const { create } = require('axios').default;

const axiosInstance = create();

class Request {
  constructor(url) {
    this.url = url;
  }

  async post(params) {
    const instance = axiosInstance;
    const response = await instance.post(this.url, params);
    return response.data;
  }

  async rpc(method, params) {
    try {
      let response = await this.post({
        jsonrpc: '2.0',
        method: method,
        params,
        id: new Date().getTime(),
      });
      if (response.error) {
        console.error('request error: ', response.error);
        throw Error('request error: ', response.error);
      }
      return response.result;
    } catch (e) {
      console.error('network error: ' + e);
      throw e;
    }
  }
}

module.exports = Request;
