/* Builds docs/assets/world.json: country outlines (Natural Earth, via world-atlas) projected to a 1000x500 SVG,
   plus a lookup from Species+ country names to map shapes. Run once; rerun only if country names change.
   npm i world-atlas topojson-client d3-geo i18n-iso-countries && node tools/build_map.js <names.json> <out.json> */
const fs = require("fs"), topo = require("topojson-client"), d3 = require("d3-geo"), iso = require("i18n-iso-countries");
iso.registerLocale(require("i18n-iso-countries/langs/en.json"));
const names = JSON.parse(fs.readFileSync(process.argv[2]));
const ALIAS = { "Bolivia (Plurinational State of)": "BO", "Bonaire Saint Eustatius and Saba": "BQ", "Cabo Verde": "CV", "Czech Republic": "CZ", "Côte d'Ivoire": "CI",
  "Democratic People's Republic of Korea": "KP", "Democratic Republic of the Congo": "CD", "Congo": "CG", "Eswatini": "SZ", "Falkland Islands (Malvinas)": "FK",
  "French Guiana [FR]": "GF", "French Southern and Antarctic Territories": "TF", "Guinea Bissau": "GW", "Heard and McDonald Islands": "HM", "Hong Kong SAR": "HK",
  "Iran (Islamic Republic of)": "IR", "Lao People's Democratic Republic": "LA", "Macao SAR": "MO", "Micronesia (Federated States of)": "FM", "Republic of Korea": "KR",
  "Republic of Moldova": "MD", "Russian Federation": "RU", "Saint Helena and Dependencies (United Kingdom)": "SH", "Saint-Barthélemy": "BL", "Saint-Martin": "MF",
  "Sint Maarten": "SX", "South Georgia and South Sandwich Islands (United Kingdom)": "GS", "State of Palestine": "PS", "Svalbard and Jan Mayen Islands": "SJ",
  "Syrian Arab Republic": "SY", "Taiwan Province of China": "TW", "Türkiye": "TR", "United Kingdom of Great Britain and Northern Ireland": "GB",
  "United Republic of Tanzania": "TZ", "United States of America": "US", "Venezuela (Bolivarian Republic of)": "VE", "Viet Nam": "VN", "Virgin Islands of the USA": "VI",
  "Wallis and Futuna Islands": "WF", "Pitcairn Islands (United Kingdom)": "PN", "Brunei Darussalam": "BN", "Timor-Leste": "TL", "North Macedonia": "MK", "Curaçao": "CW", "Réunion": "RE" };
const code = n => ALIAS[n] || iso.getAlpha2Code(n.replace(/ \(United Kingdom\)$/, ""), "en");
const w110 = require("world-atlas/countries-110m.json"), w50 = require("world-atlas/countries-50m.json");
const f110 = topo.feature(w110, w110.objects.countries).features, f50 = topo.feature(w50, w50.objects.countries).features;
const proj = d3.geoEqualEarth ? d3.geoEqualEarth() : d3.geoNaturalEarth1();
proj.fitExtent([[4, 4], [996, 496]], { type: "Sphere" });
const path = d3.geoPath(proj);
const round = d => d.replace(/-?\d+\.\d+/g, x => (+x).toFixed(1));
const shapes = {}, dots = {};
f110.forEach(f => { if (f.id && f.id !== "010") shapes[f.id] = round(path(f)); });
f50.forEach(f => { if (f.id && !shapes[f.id] && f.id !== "010") { const c = path.centroid(f); if (isFinite(c[0])) dots[f.id] = [Math.round(c[0]), Math.round(c[1])]; } });
const map = {}, missing = [];
names.forEach(n => { const a = code(n); const num = a && iso.alpha2ToNumeric(a); if (num && (shapes[num] || dots[num])) map[n] = num; else missing.push(n + (a ? " [" + a + "]" : " [?]")); });
fs.writeFileSync(process.argv[3], JSON.stringify({ note: "Country outlines: Natural Earth (public domain) via world-atlas. Equal Earth projection.", shapes, dots, names: map }));
console.log(Object.keys(shapes).length, "shapes,", Object.keys(dots).length, "dots,", Object.keys(map).length, "names mapped; not on map:", missing.join("; "));
