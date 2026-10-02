const geojsonvt = require('geojson-vt'); const vtpbf = require('vt-pbf')
const C = { lat: -23.4697, lng: -47.4297 }
const P = (dy, dx) => [C.lng + dx, C.lat + dy]
const rect = (cy, cx, h, w, rot = 0) => {
  const pts = [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2],[-w/2,-h/2]].map(([x,y]) => {
    const a = rot*Math.PI/180; return P(cy + x*Math.sin(a) + y*Math.cos(a), cx + x*Math.cos(a) - y*Math.sin(a)) })
  return { type: 'Polygon', coordinates: [pts] }
}
const F = (geometry, properties = {}) => ({ type: 'Feature', geometry, properties })
const line = (...pts) => ({ type: 'LineString', coordinates: pts.map(([y,x]) => P(y,x)) })
const layers = {
  landuse: [F({ type:'Polygon', coordinates:[[P(0.0021,-0.0024),P(0.0023,0.0022),P(-0.0002,0.0026),P(-0.0019,0.0021),P(-0.0021,-0.0019),P(0.0021,-0.0024)]] }, { class: 'university' })],
  park: [F(rect(-0.0005,-0.0013,0.0006,0.0008,0),{class:'park'}), F(rect(0.0001,0.0016,0.0005,0.0007),{class:'park'})],
  water: [F(rect(-0.0016,-0.0008,0.00025,0.0005,20),{class:'lake'})],
  building: [
    F(rect(0.0006,-0.0006,0.00028,0.0007)), F(rect(0.0011,0.0002,0.00025,0.0006)), F(rect(0.0011,0.0010,0.00025,0.0005)),
    F(rect(-0.00005,0.0007,0.0003,0.0005)), F(rect(-0.0010,-0.0002,0.0003,0.0004)), F(rect(0.0016,-0.0011,0.0003,0.0008)),
    F(rect(0.0016,-0.0001,0.0002,0.0005)), F(rect(0.0004,0.00035,0.00018,0.00025)), F(rect(-0.0009,0.0012,0.0002,0.0005)),
    F(rect(0.0005,-0.0016,0.0004,0.0003)), F(rect(-0.0012,-0.0014,0.0002,0.0003)), F(rect(0.0001,0.0016,0.00025,0.00045)),
  ].map(f => (f.properties = { render_height: 10 }, f)),
  transportation: [
    F(line([0.0026,-0.0035],[0.0028,0.0035]),{class:'primary'}), F(line([-0.0026,-0.0035],[-0.0023,0.0035]),{class:'secondary'}),
    F(line([0.0035,0.0030],[-0.0035,0.0028]),{class:'secondary'}),
    F(line([0.0002,-0.0024],[0.0003,0.0026]),{class:'minor'}), F(line([0.0021,-0.0003],[-0.0020,-0.0004]),{class:'minor'}),
    F(line([-0.0012,-0.0019],[-0.0012,0.0021]),{class:'service'}),
    F(line([0.0006,-0.0006],[0.0004,0.0004],[0.0009,0.0002]),{class:'path'}), F(line([0.0004,0.0004],[-0.0003,0.0007],[-0.0008,-0.0002]),{class:'path'}),
    F(line([0.0004,0.0004],[0.0002,0.0016]),{class:'path'}), F(line([0.0006,-0.0006],[0.0014,-0.0011]),{class:'path'}),
    F(line([-0.0003,0.0007],[-0.0012,0.0012]),{class:'path'}), F(line([-0.0008,-0.0002],[-0.0005,-0.0013]),{class:'path'}),
  ],
  poi: [], place: [],
}
const idx = Object.fromEntries(Object.entries(layers).map(([k, fs]) => [k, geojsonvt({ type:'FeatureCollection', features: fs }, { maxZoom: 20, indexMaxZoom: 14, buffer: 128 })]))
exports.tile = (z, x, y) => {
  const out = {}; for (const [k, i] of Object.entries(idx)) { const t = i.getTile(z, x, y); if (t) out[k] = t }
  return Buffer.from(vtpbf.fromGeojsonVt(out, { version: 2 }))
}
exports.tilejson = { tilejson: '2.2.0', tiles: ['https://tiles.openfreemap.org/fake/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 20,
  vector_layers: Object.keys(layers).map(id => ({ id, fields: {} })) }
