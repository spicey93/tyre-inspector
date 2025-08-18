// utils/vrmLookup.js
const apiKey = process.env.UK_VEHICLE_DATA_API_KEY;
import Vehicle from "../models/vehicle.model.js";

const normaliseVrm = (vrm) => vrm.toUpperCase().replace(/\s+/g, "");

const vrmLookup = async function (vrmRaw) {
  const vrm = normaliseVrm(vrmRaw);
  const url = `https://uk1.ukvehicledata.co.uk/api/datapackage/TyreData?v=2&api_nullitems=1&key_vrm=${encodeURIComponent(
    vrm
  )}&auth_apikey=${encodeURIComponent(apiKey ?? "")}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }

    const response = await res.json();
    if (response?.Response?.StatusCode !== "Success") return null;

    const items = response.Response.DataItems;
    const details = items?.VehicleDetails;
    const tyre = items?.TyreDetails;

    if (!details || !tyre || !Array.isArray(tyre.RecordList)) return null;

    const recordList = tyre.RecordList;

    const tyreRecords = recordList.map((record) => ({
      front: {
        size: `${record.Front.Tyre.Size} ${record.Front.Tyre.LoadIndex}${record.Front.Tyre.SpeedIndex}`,
        runflat: !!record.Front.Tyre.RunFlat,
        // schema expects Number -> choose PSI; switch to .Bar if you prefer bars
        pressure: Number(record.Front.Tyre.Pressure?.Psi ?? 0),
      },
      rear: {
        size: `${record.Rear.Tyre.Size} ${record.Rear.Tyre.LoadIndex}${record.Rear.Tyre.SpeedIndex}`,
        runflat: !!record.Rear.Tyre.RunFlat,
        pressure: Number(record.Rear.Tyre.Pressure?.Psi ?? 0),
      },
    }));

    const torque =
      recordList[0]?.Fixing?.Torque != null ? String(recordList[0].Fixing.Torque) : undefined;

    // If you want to overwrite existing by VRM, use upsert:
    const doc = {
      vrm,
      make: details.Make,
      model: details.Model,
      year: details.BuildYear,
      tyreRecords,
      torque,
    };

    // Upsert (replace insert+save) to avoid duplicate key errors
    const newVehicle = await Vehicle.findOneAndUpdate(
      { vrm },
      doc,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return newVehicle;
  } catch (err) {
    // log if needed
    return null;
  }
};

export default vrmLookup;
