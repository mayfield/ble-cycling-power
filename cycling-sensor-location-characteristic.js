const util = require('util');
const bleno = require('bleno');

const Characteristic = bleno.Characteristic;

// Profile:
// https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.sensor_location.xml
// 13 = rear hub
// 15 = spider

const CyclingSensorLocationCharacteristic = function() {
  CyclingSensorLocationCharacteristic.super_.call(this, {
    uuid: '2A5D',
    properties: ['read'],
    value: Buffer.from([/*spider*/ 15])
  });
};

util.inherits(CyclingSensorLocationCharacteristic, Characteristic);

module.exports = CyclingSensorLocationCharacteristic;
