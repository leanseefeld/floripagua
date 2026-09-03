// Geographic helpers. Scene units are metres in a local tangent plane (ENU) centred on ORIGIN.
export const ORIGIN = { lat: -27.60, lon: -48.60 }; // centre of Greater Florianópolis
const R = 6378137;
const cosLat0 = Math.cos(ORIGIN.lat * Math.PI / 180);

/** lon/lat -> {x (east, m), z (south, m)}. Three.js: x east, y up, z toward viewer (south). */
export function toXZ(lon, lat) {
  const x = (lon - ORIGIN.lon) * Math.PI / 180 * R * cosLat0;
  const z = -(lat - ORIGIN.lat) * Math.PI / 180 * R;
  return { x, z };
}
export function fromXZ(x, z) {
  const lon = ORIGIN.lon + x / (R * cosLat0) * 180 / Math.PI;
  const lat = ORIGIN.lat - z / R * 180 / Math.PI;
  return { lon, lat };
}
export function distMeters(a, b) {
  const p = toXZ(a.lon, a.lat), q = toXZ(b.lon, b.lat);
  return Math.hypot(p.x - q.x, p.z - q.z);
}
/** Web-mercator y for latitude (radians-normalised 0..1 like tile schemes). */
export function mercY(lat) {
  const s = Math.sin(lat * Math.PI / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}
