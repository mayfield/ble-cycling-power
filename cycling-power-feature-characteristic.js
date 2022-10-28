var util = require('util');
var bleno = require('bleno');

var Characteristic = bleno.Characteristic;


var CyclingPowerFeatureCharacteristic = function() {
  CyclingPowerFeatureCharacteristic.super_.call(this, {
    uuid: '2A65',
    properties: ['read'],
    // 0x01 - pedal power balance supported
    // 0x02 - accumulated torque supported
    // 0x04 - wheel revolutions supported
    // 0x08 - crank revolutions supported
    value: Buffer.from([0x8, 0, 0, 0]), // crank rev
  });
};

util.inherits(CyclingPowerFeatureCharacteristic, Characteristic);

module.exports = CyclingPowerFeatureCharacteristic;
