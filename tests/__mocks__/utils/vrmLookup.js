// tests/__mocks__/utils/vrmLookup.js
// This is a *manual mock* that Vitest will pick up when we vi.mock() the module path.
// It simulates finding/creating a Vehicle document for a VRM lookup.

import Vehicle from "../../../models/vehicle.model.js";

export default async function vrmLookupMock(vrm) {
  if (!vrm || vrm === "NOTFOUND") return null;

  // Create (or return existing) a minimal vehicle with tyre records
  let v = await Vehicle.findOne({ vrm }).lean();
  if (v) return v;

  return await Vehicle.create({
    vrm,
    make: "TestMake",
    model: "TestModel",
    year: "2021",
    torque: "120",
    tyreRecords: [
      {
        front: { size: "225/45R17 91W", runflat: false, pressure: 32 },
        rear: { size: "225/45R17 91W", runflat: false, pressure: 32 },
      },
      {
        front: { size: "245/40R18 97Y", runflat: true, pressure: 34 },
        rear: { size: "265/35R18 97Y", runflat: true, pressure: 36 },
      },
    ],
  });
}
