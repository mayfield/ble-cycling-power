var util = require('util');

var bleno = require('bleno');


var RSCFeatureCharacteristic = function() {
    RSCFeatureCharacteristic.super_.call(this, {
        uuid: '2A54',
        properties: ['read'],
        value: Buffer.from([0b100, 0]),
    });
};
util.inherits(RSCFeatureCharacteristic, bleno.Characteristic);

var RSCMeasurementCharacteristic = function() {
    RSCMeasurementCharacteristic.super_.call(this, {
        uuid: '2A53',
        properties: ['read', 'notify'],
    });
    this._updateValueCallback = null;
};

util.inherits(RSCMeasurementCharacteristic, bleno.Characteristic);

RSCMeasurementCharacteristic.prototype.onSubscribe = function(maxValueSize, updateValueCallback) {
  console.log('[BLE] client subscribed to RSC');
  this._updateValueCallback = updateValueCallback;
};

RSCMeasurementCharacteristic.prototype.onUnsubscribe = function() {
  console.log('[BLE] client unsubscribed from RSC');
  this._updateValueCallback = null;
};

RSCMeasurementCharacteristic.prototype.notify = function(event) {
  const buffer = Buffer.alloc(4);
  // flags
  // 00000001 - 1   - 0x01 - Instantaneous Stride Length Present
  // 00000010 - 2   - 0x02 - Total Distance Present
  // 00000100 - 4   - 0x04 - Walking or Running Status
  buffer.writeUInt8(0x0 | (event.speed > 6 ? 0x4 : 0));
  if ('speed' in event) {
    // kmh -> ((meters per second) * 256)
    buffer.writeUInt16LE(Math.min(0xffff, Math.round(event.speed * 1000 / 3600 * 256)), 1);
  }
  if ('cadence' in event) {
    buffer.writeUInt8(Math.min(0xff, Math.round(event.cadence)), 3);
  }
  if (this._updateValueCallback) {
    this._updateValueCallback(buffer);
  }
};


module.exports = {RSCMeasurementCharacteristic, RSCFeatureCharacteristic};
