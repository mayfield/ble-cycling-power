const util = require('util');
const bleno = require('bleno');

var SensorLocationCharacteristic = function() {
    SensorLocationCharacteristic.super_.call(this, {
        uuid: '2A38',
        properties: ['read'],
        // 1 = chest
        value: Buffer.alloc([1])
    });
};
util.inherits(SensorLocationCharacteristic, bleno.Characteristic);

module.exports = SensorLocationCharacteristic;
