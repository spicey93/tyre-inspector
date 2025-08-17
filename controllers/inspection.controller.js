import Vehicle from "../models/vehicle.model.js";
import vrmLookup from "../utils/vrmLookup.js";

const normaliseVrm = (v) => v.toUpperCase().trim().replace(/\s+/g, "");

export const newInspection = async (req, res) => {
  try {
    const raw = (req.query.vrm || "").trim();
    if (!raw) {
      // No VRM provided—render empty form (or show a message)
      return res.render("inspections/new", { vehicle: null, error: null });
    }

    const vrm = normaliseVrm(raw);

    // 1) Try DB first
    let vehicle = await Vehicle.findOne({ vrm }).lean();

    // 2) If not found, hit the API (vrmLookup will upsert and return the doc)
    if (!vehicle) {
      const created = await vrmLookup(vrm); // returns null on failure
      if (!created) {
        return res.status(404).render("inspections/new", {
          vehicle: null,
          error: `Couldn’t find tyre data for VRM ${vrm}. Check the plate and try again.`,
        });
      }
      // If your vrmLookup returns a Mongoose doc, convert to plain object for templating
      vehicle = created.toObject ? created.toObject() : created;
    }

    // 3) Render the form with vehicle data
    //    Your view can access: vehicle.make, vehicle.model, vehicle.year, vehicle.tyreRecords, vehicle.torque, etc.
    return res.render("inspections/new", { vehicle, error: null });
  } catch (err) {
    // Log and show a friendly error
    console.error("GET /inspections/new error:", err);
    return res
      .status(500)
      .render("inspections/new", {
        vehicle: null,
        error: "Something went wrong. Please try again.",
      });
  }
};
