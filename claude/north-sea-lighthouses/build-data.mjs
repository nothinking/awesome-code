import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAW_PATH = path.join(__dirname, "data", "raw-overpass.json");
const OUTPUT_JS_PATH = path.join(__dirname, "data.js");
const OUTPUT_JSON_PATH = path.join(__dirname, "data", "processed-lighthouses.json");

const BOUNDS = {
  minLat: 50.6,
  maxLat: 61.6,
  minLon: -2.8,
  maxLon: 10.8,
};

const NORTH_SEA_POLYGON = [
  [1.0, 50.7],
  [2.8, 50.95],
  [5.4, 51.55],
  [8.8, 53.3],
  [10.5, 56.1],
  [10.4, 58.5],
  [8.4, 60.8],
  [4.8, 61.45],
  [0.8, 61.15],
  [-1.15, 60.55],
  [-2.2, 59.35],
  [-2.35, 57.8],
  [-2.1, 56.25],
  [-1.7, 54.8],
  [-0.9, 53.15],
  [0.2, 51.9],
];

const EXCLUDED_TYPES = new Set([
  "beacon_lateral",
  "beacon_special_purpose",
  "building",
  "light_vessel",
  "radar_station",
  "signal_station_traffic",
]);

const LIGHT_FIELDS = new Set([
  "character",
  "colour",
  "group",
  "height",
  "period",
  "range",
  "reference",
  "sector_end",
  "sector_start",
  "sequence",
  "visibility",
]);

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function pointInPolygon(lon, lat, polygon) {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [x1, y1] = polygon[index];
    const [x2, y2] = polygon[previous];
    const intersects =
      y1 > lat !== y2 > lat &&
      lon < ((x2 - x1) * (lat - y1)) / (y2 - y1 || Number.EPSILON) + x1;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function parseColourList(value) {
  if (!value) {
    return [];
  }

  return [...new Set(
    String(value)
      .split(/[;\\/]/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  )];
}

function formatCharacteristic(character, group) {
  if (!character) {
    return null;
  }

  return group ? `${character}(${group})` : character;
}

function formatPattern(light) {
  const characteristic = formatCharacteristic(light.character, light.group);
  if (!characteristic && !light.period) {
    return "N/A";
  }

  if (characteristic && light.period) {
    return `${characteristic} ${light.period}s`;
  }

  if (characteristic) {
    return characteristic;
  }

  return `${light.period}s`;
}

function extractUrl(text) {
  if (!text) {
    return null;
  }

  const match = String(text).match(/https?:\/\/\S+/);
  return match ? match[0] : null;
}

function buildWikipediaUrl(value) {
  if (!value) {
    return null;
  }

  const [language, ...rest] = String(value).split(":");
  const article = rest.join(":");

  if (!language || !article) {
    return null;
  }

  return `https://${language}.wikipedia.org/wiki/${encodeURIComponent(article.replace(/ /g, "_"))}`;
}

function extractLights(tags) {
  const numbered = new Map();
  const primary = {};

  for (const [key, rawValue] of Object.entries(tags)) {
    if (!key.startsWith("seamark:light:")) {
      continue;
    }

    const numberedMatch = key.match(/^seamark:light:(\d+):(.+)$/);
    if (numberedMatch) {
      const [, index, field] = numberedMatch;
      if (!LIGHT_FIELDS.has(field)) {
        continue;
      }

      if (!numbered.has(index)) {
        numbered.set(index, {});
      }

      numbered.get(index)[field] = rawValue;
      continue;
    }

    const field = key.slice("seamark:light:".length);
    if (LIGHT_FIELDS.has(field)) {
      primary[field] = rawValue;
    }
  }

  const lights = [];

  if (Object.keys(primary).length > 0) {
    lights.push(primary);
  }

  for (const entry of numbered.values()) {
    lights.push(entry);
  }

  return lights
    .map((light, index) => {
      const colours = parseColourList(light.colour);
      const rangeNm = toNumber(light.range);
      const periodSeconds = toNumber(light.period);
      const sectorStart = toNumber(light.sector_start);
      const sectorEnd = toNumber(light.sector_end);

      return {
        id: index + 1,
        character: light.character || null,
        colours,
        group: light.group || null,
        heightMeters: toNumber(light.height),
        period: periodSeconds,
        rangeNm,
        reference: light.reference || null,
        sectorEnd,
        sectorStart,
        sequence: light.sequence || null,
        visibility: light.visibility || null,
        pattern: formatPattern({
          character: light.character,
          group: light.group,
          period: periodSeconds,
        }),
      };
    })
    .filter((light) => isFiniteNumber(light.rangeNm));
}

function guessRegion(lat, lon) {
  if (lon <= 2.2) {
    return "Great Britain";
  }

  if (lat >= 57.2) {
    return "Norway";
  }

  if (lon >= 8.6) {
    return "Denmark";
  }

  if (lon >= 6.4) {
    return "Germany";
  }

  if (lat <= 51.45) {
    return "Belgium / France";
  }

  return "Netherlands";
}

function buildRecord(element) {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat ?? null;
  const lon = element.lon ?? element.center?.lon ?? null;

  if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) {
    return null;
  }

  if (lat < BOUNDS.minLat || lat > BOUNDS.maxLat || lon < BOUNDS.minLon || lon > BOUNDS.maxLon) {
    return null;
  }

  if (!pointInPolygon(lon, lat, NORTH_SEA_POLYGON)) {
    return null;
  }

  if (tags.man_made !== "lighthouse") {
    return null;
  }

  const seamarkType = tags["seamark:type"] || "lighthouse";
  if (EXCLUDED_TYPES.has(seamarkType)) {
    return null;
  }

  const lights = extractLights(tags);
  if (lights.length === 0) {
    return null;
  }

  lights.sort((left, right) => {
    if ((right.rangeNm || 0) !== (left.rangeNm || 0)) {
      return (right.rangeNm || 0) - (left.rangeNm || 0);
    }

    return (left.id || 0) - (right.id || 0);
  });

  const primaryLight = lights[0];
  const colours = [...new Set(lights.flatMap((light) => light.colours))];
  const name =
    tags["seamark:name"] ||
    tags.name ||
    tags["name:en"] ||
    `Unnamed lighthouse ${element.id}`;
  const sourceText = tags["seamark:source"] || tags.source || null;

  return {
    id: `${element.type}-${element.id}`,
    osmId: element.id,
    osmType: element.type,
    name,
    lat,
    lon,
    region: guessRegion(lat, lon),
    type: seamarkType,
    reference:
      primaryLight.reference ||
      tags["ref:admiralty"] ||
      tags["ref:nga"] ||
      tags["ref:aladin"] ||
      null,
    rangeNm: primaryLight.rangeNm,
    heightMeters: primaryLight.heightMeters,
    primaryColour: primaryLight.colours[0] || "white",
    colours,
    pattern: primaryLight.pattern,
    sequence: primaryLight.sequence,
    periodSeconds: primaryLight.period,
    visibility: primaryLight.visibility,
    sourceText,
    sourceUrl: extractUrl(sourceText),
    info: tags["seamark:information"] || null,
    osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    wikipedia: buildWikipediaUrl(tags.wikipedia),
    wikidata: tags.wikidata ? `https://www.wikidata.org/wiki/${tags.wikidata}` : null,
    lights,
  };
}

function dedupe(records) {
  const seen = new Map();

  for (const record of records) {
    const key = `${record.name.toLowerCase()}|${record.lat.toFixed(4)}|${record.lon.toFixed(4)}`;
    const existing = seen.get(key);

    if (!existing || (record.rangeNm || 0) > (existing.rangeNm || 0)) {
      seen.set(key, record);
    }
  }

  return [...seen.values()];
}

function buildMetadata(raw, records) {
  const ranges = records
    .map((record) => record.rangeNm)
    .filter(isFiniteNumber)
    .sort((left, right) => left - right);
  const colours = records.flatMap((record) => record.colours);
  const colourCounts = colours.reduce((map, colour) => {
    map.set(colour, (map.get(colour) || 0) + 1);
    return map;
  }, new Map());
  const topColour = [...colourCounts.entries()].sort((left, right) => right[1] - left[1])[0] || null;
  const medianIndex = Math.floor(ranges.length / 2);
  const medianRangeNm = ranges.length ? ranges[medianIndex] : null;
  const longest = records[0] || null;

  return {
    source: "OpenStreetMap seamark tags via Overpass API",
    generatedAt: new Date().toISOString(),
    osmBaseTimestamp: raw.osm3s?.timestamp_osm_base || null,
    bounds: BOUNDS,
    polygon: NORTH_SEA_POLYGON,
    lighthouseCount: records.length,
    medianRangeNm,
    topColour: topColour ? { colour: topColour[0], count: topColour[1] } : null,
    longestRange: longest
      ? {
          name: longest.name,
          rangeNm: longest.rangeNm,
        }
      : null,
    notes: [
      "Displayed records are OSM features tagged as man_made=lighthouse with seamark light characteristics.",
      "The map filters to a North Sea polygon to exclude most Atlantic, Irish Sea, and Channel lighthouses.",
      "Some records contain multiple sector lights; the detail panel exposes each sector as stored in seamark tags.",
    ],
  };
}

async function main() {
  const raw = JSON.parse(await fs.readFile(RAW_PATH, "utf8"));
  const records = dedupe(
    raw.elements
      .map(buildRecord)
      .filter(Boolean)
      .sort((left, right) => {
        if ((right.rangeNm || 0) !== (left.rangeNm || 0)) {
          return (right.rangeNm || 0) - (left.rangeNm || 0);
        }

        return left.name.localeCompare(right.name, "en");
      })
  );

  const payload = {
    metadata: buildMetadata(raw, records),
    lighthouses: records,
  };

  await fs.writeFile(OUTPUT_JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  await fs.writeFile(
    OUTPUT_JS_PATH,
    `window.NORTH_SEA_LIGHTHOUSES_DATA = ${JSON.stringify(payload, null, 2)};\n`
  );

  console.log(
    `Built ${records.length} North Sea lighthouse records from ${raw.elements.length} raw OSM features.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
