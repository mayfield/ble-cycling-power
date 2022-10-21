const util = require('util');
const bleno = require('bleno');

const Descriptor = bleno.Descriptor;
const Characteristic = bleno.Characteristic;

// Spec
//https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.cycling_power_measurement.xml

var CyclingPowerMeasurementCharacteristic = function() {
  CyclingPowerMeasurementCharacteristic.super_.call(this, {
    uuid: '2A63',
    properties: ['notify'],
    descriptors: [
      new Descriptor({
        // Client Characteristic Configuration
        uuid: '2902',
        value: Buffer.from([1, 0])  // notifications enabled
      }),
      new Descriptor({
        // Server Characteristic Configuration
        uuid: '2903',
        value: Buffer.from([0, 0])  // broadcasts disabled
      })
    ]
  });

  this._updateValueCallback = null;
};

util.inherits(CyclingPowerMeasurementCharacteristic, Characteristic);

CyclingPowerMeasurementCharacteristic.prototype.onSubscribe = function(maxValueSize, updateValueCallback) {
  console.log('[BLE] client subscribed to PM');
  this._updateValueCallback = updateValueCallback;
  if (this.lastBuffer) {
    console.warn("Sending last good buffer to newly subscribed client");
    const buffer = this.lastBuffer;
    this.lastBuffer = null;
    updateValueCallback(buffer);
  }
};

CyclingPowerMeasurementCharacteristic.prototype.onUnsubscribe = function() {
  console.log('[BLE] client unsubscribed from PM');
  this._updateValueCallback = null;
};

CyclingPowerMeasurementCharacteristic.prototype.notify = function(event) {
  const buffer = Buffer.alloc(8);
  // flags
  // 00000001 - 1   - 0x001 - Pedal Power Balance Present
  // 00000010 - 2   - 0x002 - Pedal Power Balance Reference
  // 00000100 - 4   - 0x004 - Accumulated Torque Present
  // 00001000 - 8   - 0x008 - Accumulated Torque Source
  // 00010000 - 16  - 0x010 - Wheel Revolution Data Present
  // 00100000 - 32  - 0x020 - Crank Revolution Data Present
  // 01000000 - 64  - 0x040 - Extreme Force Magnitudes Present
  // 10000000 - 128 - 0x080 - Extreme Torque Magnitudes Present
  buffer.writeUInt16LE(0x020, 0);
  if ('watts' in event) {
    const watts = event.watts;
    buffer.writeInt16LE(Math.round(watts), 2);
  }

  let revCount;
  let revTime;
  if ('cadence' in event) {
    const rps = event.cadence / 60;
    if (!this._lastRevCount) {
        revCount = 1;
        revTime = 1 / rps;
    } else {
        revCount = this._lastRevCount + 1;
        revTime = this._lastRevTime + (1 / rps);
    }
    this._lastRevCount = revCount;
    this._lastRevTime = revTime;
  }
  if (revCount !== undefined) {
    buffer.writeUInt16LE(revCount & 0xffff, 4);
    const btTime = Math.round(revTime * 1024) & 0xffff;
    buffer.writeUInt16LE(btTime, 6);
  }
  if (this._updateValueCallback) {
    this.lastBuffer = null;
    this._updateValueCallback(buffer);
  } else {
    this.lastBuffer = buffer;
  }
};

module.exports = CyclingPowerMeasurementCharacteristic;
