const constants = require('./const');
module.exports = {
  unix() {
    return new Date().getTime();
  },
  getModuleName(id) {
    let n = id.lastIndexOf('\\');
    if (n === -1) {
      n = id.lastIndexOf('/');
    }
    if (n === -1) {
      return '';
    } else {
      return id.substring(n + 1);
    }
  },
  toTimestamp(epochTime) {
    return epochTime * 1000 + constants.EPOCH;
  },
  thousandSeparator(num, doBold) {
    const parts = (num + '').split('.');
    const main = parts[0];
    const len = main.length;
    let output = '';
    let i = len - 1;

    while (i >= 0) {
      output = main.charAt(i) + output;
      if ((len - i) % 3 === 0 && i > 0) {
        output = ' ' + output;
      }
      --i;
    }

    if (parts.length > 1) {
      if (doBold) {
        output = `**${output}**.${parts[1]}`;
      } else {
        output = `${output}.${parts[1]}`;
      }
    }
    return output;
  },
  /**
   * Formats unix timestamp to string
   * @param {number} timestamp Timestamp to format
   * @return {object} Contains different formatted strings
   */
  formatDate(timestamp) {
    if (!timestamp) {
      return false;
    }
    const formattedDate = {};
    const dateObject = new Date(timestamp);
    formattedDate.year = dateObject.getFullYear();
    formattedDate.month = ('0' + (dateObject.getMonth() + 1)).slice(-2);
    formattedDate.date = ('0' + dateObject.getDate()).slice(-2);
    formattedDate.hours = ('0' + dateObject.getHours()).slice(-2);
    formattedDate.minutes = ('0' + dateObject.getMinutes()).slice(-2);
    formattedDate.seconds = ('0' + dateObject.getSeconds()).slice(-2);
    formattedDate.YYYY_MM_DD = formattedDate.year + '-' + formattedDate.month + '-' + formattedDate.date;
    formattedDate.YYYY_MM_DD_hh_mm = formattedDate.year + '-' + formattedDate.month + '-' + formattedDate.date + ' ' + formattedDate.hours + ':' + formattedDate.minutes;
    formattedDate.hh_mm_ss = formattedDate.hours + ':' + formattedDate.minutes + ':' + formattedDate.seconds;
    return formattedDate;
  },
  /**
   * Compares two strings, case-insensitive
   * @param {string} string1
   * @param {string} string2
   * @return {boolean} True, if strings are equal, case-insensitive
   */
  isStringEqualCI(string1, string2) {
    if (typeof string1 !== 'string' || typeof string2 !== 'string') return false;
    return string1.toUpperCase() === string2.toUpperCase();
  },
  /**
   * Checks if number is finite
   * @param {number} value Number to validate
   * @return {boolean}
   */
  isNumber(value) {
    if (typeof (value) !== 'number' || isNaN(value) || !Number.isFinite(value)) {
      return false;
    }
    return true;
  },
  /**
   * Checks if number is finite and not less, than 0
   * @param {number} value Number to validate
   * @return {boolean}
   */
  isPositiveOrZeroNumber(value) {
    if (!this.isNumber(value) || value < 0) {
      return false;
    }
    return true;
  },
  /**
   * Converts a bytes array to the respective string representation
   * @param {Array<number>|Uint8Array} bytes bytes array
   * @return {string}
   */
  bytesToHex(bytes = []) {
    const hex = [];
    bytes.forEach((b) => hex.push(
        (b >>> 4).toString(16),
        (b & 0xF).toString(16),
    ));
    return hex.join('');
  },
};
