const util = require('util');
const bleno = require('bleno');

const Descriptor = bleno.Descriptor;
const Characteristic = bleno.Characteristic;

// Profile:
// https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.sensor_location.xml
// 13 = rear hub
// 15 = spider

const CyclingSensorLocationCharacteristic = function() {
  CyclingSensorLocationCharacteristic.super_.call(this, {
    uuid: '2A5D',
    properties: ['read'],
    value: new Buffer([/*spider*/ 15])
  });
};

util.inherits(CyclingSensorLocationCharacteristic, Characteristic);

CyclingSensorLocationCharacteristic.prototype.onReadRequest = function(offset, callback) {
  // return hardcoded value
  callback(this.RESULT_SUCCESS, new Buffer([/*spider*/ 15]));
};

module.exports = CyclingSensorLocationCharacteristic;
