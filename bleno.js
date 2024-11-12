// BLE library space is redonkulous.
// Create a wrapper here so we don't have to touch a million files everytime the
// flavor of the month changes.

const bleno = require('@stoprocent/bleno');

module.exports = bleno;
