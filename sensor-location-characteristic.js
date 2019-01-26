const util = require('util');
const bleno = require('bleno');

const Descriptor = bleno.Descriptor;
const Characteristic = bleno.Characteristic;

// Profile:
// https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.body_sensor_location.xml
// 1 = chest

var SensorLocationCharacteristic = function() {
  SensorLocationCharacteristic.super_.call(this, {
    uuid: '2A38',
    properties: ['read'],
    value: new Buffer([1])
  });
};

util.inherits(SensorLocationCharacteristic, Characteristic);

SensorLocationCharacteristic.prototype.onReadRequest = function(offset, callback) {
  // return hardcoded value
  callback(this.RESULT_SUCCESS, new Buffer([1]));
};

module.exports = SensorLocationCharacteristic;
