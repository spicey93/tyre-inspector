import test from 'node:test';
import assert from 'node:assert/strict';
import vrmLookup, { normaliseVrm } from './vrmLookup.js';
import Vehicle from '../models/vehicle.model.js';

test('normaliseVrm uppercases and strips spaces', () => {
  assert.equal(normaliseVrm('ab 12 cd'), 'AB12CD');
});

test('vrmLookup returns null when fetch response not ok', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false });

  const result = await vrmLookup('ab12cd');
  assert.equal(result, null);

  global.fetch = originalFetch;
});

test('vrmLookup upserts vehicle on success', async () => {
  const originalFetch = global.fetch;
  const originalFn = Vehicle.findOneAndUpdate;

  const responseData = {
    Response: {
      StatusCode: 'Success',
      DataItems: {
        VehicleDetails: { Make: 'Tesla', Model: 'Model S', BuildYear: '2021' },
        TyreDetails: {
          RecordList: [
            {
              Front: {
                Tyre: {
                  Size: '205/55 R16',
                  LoadIndex: '91',
                  SpeedIndex: 'V',
                  RunFlat: 1,
                  Pressure: { Psi: '32' }
                }
              },
              Rear: {
                Tyre: {
                  Size: '205/55 R16',
                  LoadIndex: '94',
                  SpeedIndex: 'V',
                  RunFlat: 0,
                  Pressure: { Psi: '34' }
                }
              },
              Fixing: { Torque: 100 }
            }
          ]
        }
      }
    }
  };

  global.fetch = async () => ({ ok: true, json: async () => responseData });

  const saved = { id: '1' };
  Vehicle.findOneAndUpdate = async (...args) => saved;

  const result = await vrmLookup('ab12cd');
  assert.equal(result, saved);

  global.fetch = originalFetch;
  Vehicle.findOneAndUpdate = originalFn;
});
