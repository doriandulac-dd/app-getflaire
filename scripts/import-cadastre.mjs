#!/usr/bin/env node

/*
  Streaming importer for official French cadastral GeoJSON archives.

  Example:
    npm run import:cadastre -- \
      --dir data/cadastre/10 \
      --department 10 \
      --vintage-date 2026-06-20 \
      --supabase-url "$SUPABASE_URL" \
      --service-role-key "$SUPABASE_SERVICE_ROLE_KEY"

  Use --dry-run to validate parsing and normalization without writing to Supabase.
  The service-role key must only be used from a trusted server or local shell.
*/

import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { createGunzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const LAYERS = [
  {
    name: 'communes',
    file: 'cadastre-{department}-communes.json.gz',
    mapFeature: ({ feature, departmentCode, vintageDate }) => {
      const props = feature.properties ?? {};
      const sourceId = stringOrNull(feature.id ?? props.id);

      return {
        source_id: sourceId,
        department_code: departmentCode,
        commune_code: requiredString(props.id ?? sourceId, 'commune id'),
        name: requiredString(props.nom, 'commune name'),
        source_created_on: dateOrNull(props.created),
        source_updated_on: dateOrNull(props.updated),
        vintage_date: vintageDate,
        source_hash: featureHash(feature),
        geometry: normalizeGeometry(feature.geometry),
      };
    },
  },
  {
    name: 'sections',
    file: 'cadastre-{department}-sections.json.gz',
    mapFeature: ({ feature, departmentCode, vintageDate }) => {
      const props = feature.properties ?? {};
      const prefixCode = leftPad(props.prefixe, 3);
      const sectionCode = leftPad(props.code, 2);

      return {
        source_id: stringOrNull(feature.id ?? props.id),
        department_code: departmentCode,
        commune_code: requiredString(props.commune, 'section commune'),
        prefix_code: prefixCode,
        section_code: sectionCode,
        source_created_on: dateOrNull(props.created),
        source_updated_on: dateOrNull(props.updated),
        vintage_date: vintageDate,
        source_hash: featureHash(feature),
        geometry: normalizeGeometry(feature.geometry),
      };
    },
  },
  {
    name: 'parcels',
    file: 'cadastre-{department}-parcelles.json.gz',
    mapFeature: ({ feature, departmentCode, vintageDate }) => {
      const props = feature.properties ?? {};
      const communeCode = requiredString(props.commune, 'parcel commune');
      const prefixCode = leftPad(props.prefixe, 3);
      const sectionCode = leftPad(props.section, 2);
      const parcelNumber = leftPad(props.numero, 4);

      return {
        source_id: stringOrNull(feature.id ?? props.id),
        department_code: departmentCode,
        commune_code: communeCode,
        prefix_code: prefixCode,
        section_code: sectionCode,
        parcel_number: parcelNumber,
        parcel_code: `${communeCode}${prefixCode}${sectionCode}${parcelNumber}`,
        area_cadastre: integerOrNull(props.contenance),
        is_surveyed: booleanOrNull(props.arpente),
        source_created_on: dateOrNull(props.created),
        source_updated_on: dateOrNull(props.updated),
        vintage_date: vintageDate,
        source_hash: featureHash(feature),
        geometry: normalizeGeometry(feature.geometry),
      };
    },
  },
  {
    name: 'buildings',
    file: 'cadastre-{department}-batiments.json.gz',
    mapFeature: ({ feature, departmentCode, vintageDate }) => {
      const props = feature.properties ?? {};

      return {
        source_id: null,
        department_code: departmentCode,
        commune_code: requiredString(props.commune, 'building commune'),
        building_type: stringOrNull(props.type),
        name: stringOrNull(props.nom),
        source_created_on: dateOrNull(props.created),
        source_updated_on: dateOrNull(props.updated),
        vintage_date: vintageDate,
        source_hash: featureHash(feature),
        geometry: normalizeGeometry(feature.geometry),
      };
    },
  },
  {
    name: 'cadastral_sheets',
    file: 'cadastre-{department}-feuilles.json.gz',
    mapFeature: ({ feature, departmentCode, vintageDate }) => {
      const props = feature.properties ?? {};

      return {
        source_id: requiredString(feature.id ?? props.id, 'sheet id'),
        department_code: departmentCode,
        commune_code: requiredString(props.commune, 'sheet commune'),
        prefix_code: leftPad(props.prefixe, 3),
        section_code: leftPad(props.section, 2),
        sheet_number: leftPad(props.numero, 2),
        quality_code: stringOrNull(props.qualite),
        confection_mode: stringOrNull(props.modeConfection),
        scale: integerOrNull(props.echelle),
        source_created_on: dateOrNull(props.created),
        source_updated_on: dateOrNull(props.updated),
        vintage_date: vintageDate,
        source_hash: featureHash(feature),
        geometry: normalizeGeometry(feature.geometry),
      };
    },
  },
  {
    name: 'localities',
    file: 'cadastre-{department}-lieux_dits.json.gz',
    mapFeature: ({ feature, departmentCode, vintageDate }) => {
      const props = feature.properties ?? {};

      return {
        source_id: null,
        department_code: departmentCode,
        commune_code: requiredString(props.commune, 'locality commune'),
        name: stringOrNull(props.nom),
        source_created_on: dateOrNull(props.created),
        source_updated_on: dateOrNull(props.updated),
        vintage_date: vintageDate,
        source_hash: featureHash(feature),
        geometry: normalizeGeometry(feature.geometry),
      };
    },
  },
  {
    name: 'section_prefixes',
    file: 'cadastre-{department}-prefixes_sections.json.gz',
    mapFeature: ({ feature, departmentCode, vintageDate }) => {
      const props = feature.properties ?? {};

      return {
        source_id: stringOrNull(feature.id ?? props.id),
        department_code: departmentCode,
        commune_code: requiredString(props.commune, 'section prefix commune'),
        prefix_code: leftPad(props.prefixe, 3),
        old_commune_code: stringOrNull(props.ancienne),
        name: stringOrNull(props.nom),
        vintage_date: vintageDate,
        source_hash: featureHash(feature),
        geometry: normalizeGeometry(feature.geometry),
      };
    },
  },
  {
    name: 'fiscal_subdivisions',
    file: 'cadastre-{department}-subdivisions_fiscales.json.gz',
    mapFeature: ({ feature, departmentCode, vintageDate }) => {
      const props = feature.properties ?? {};
      const parcelCode = normalizeReference(props.parcelle);

      return {
        source_id: null,
        department_code: departmentCode,
        commune_code: parcelCode ? parcelCode.slice(0, 5) : null,
        parcel_code: parcelCode,
        fiscal_letter: stringOrNull(props.lettre),
        source_created_on: dateOrNull(props.created),
        source_updated_on: dateOrNull(props.updated),
        vintage_date: vintageDate,
        source_hash: featureHash(feature),
        geometry: normalizeGeometry(feature.geometry),
      };
    },
  },
];

const args = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args['dry-run']);
const batchSize = parsePositiveInteger(args['batch-size'] ?? process.env.CADASTRE_BATCH_SIZE ?? '500');
const departmentCode = leftPad(args.department, 2);
const vintageDate = requiredString(args['vintage-date'], 'vintage date');
const sourceDir = requiredString(args.dir, 'source directory');
const supabaseUrl = args['supabase-url'] ?? process.env.SUPABASE_URL;
const serviceRoleKey = args['service-role-key'] ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const selectedLayers = parseLayerSelection(args.layers);

validateIsoDate(vintageDate, 'vintage date');

if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
  throw new Error('Missing Supabase credentials. Pass --supabase-url and --service-role-key, or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = dryRun
  ? null
  : createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

await main();

async function main() {
  console.log(`Cadastre import ${dryRun ? '(dry-run) ' : ''}department=${departmentCode} vintage=${vintageDate}`);
  console.log(`Source directory: ${sourceDir}`);
  console.log(`Batch size: ${batchSize}`);

  for (const layer of LAYERS.filter((candidate) => selectedLayers.has(candidate.name))) {
    await importLayer(layer);
  }

  if (!dryRun && selectedLayers.has('parcels') && selectedLayers.has('buildings')) {
    console.log('Refreshing parcel/building intersections...');
    const { data, error } = await supabase.rpc('refresh_geo_parcel_buildings', {
      p_department_code: departmentCode,
      p_vintage_date: vintageDate,
      p_import_job_id: null,
    });

    if (error) {
      throw new Error(`refresh_geo_parcel_buildings failed: ${error.message}`);
    }

    console.log(`Parcel/building intersections refreshed: ${data}`);
  }
}

async function importLayer(layer) {
  const fileName = layer.file.replace('{department}', departmentCode);
  const filePath = path.join(sourceDir, fileName);
  await access(filePath);

  const job = dryRun
    ? { id: 'dry-run', last_feature_index: 0 }
    : await startJob(layer, fileName);

  const resumeAfter = Number(job.last_feature_index ?? 0);
  const batch = [];
  let seen = 0;
  let skipped = 0;
  let imported = 0;
  let lastFlushedFeatureIndex = resumeAfter;
  let failed = false;
  const startedAt = Date.now();

  console.log(`\n[${layer.name}] ${filePath}`);
  if (resumeAfter > 0) {
    console.log(`[${layer.name}] resuming after feature ${resumeAfter}`);
  }

  try {
    for await (const feature of streamFeatureCollection(filePath)) {
      seen += 1;

      if (seen <= resumeAfter) {
        continue;
      }

      try {
        const row = layer.mapFeature({ feature, departmentCode, vintageDate });
        if (!row.geometry) {
          skipped += 1;
          continue;
        }
        batch.push(row);
      } catch (error) {
        skipped += 1;
        console.warn(`[${layer.name}] skipped feature ${seen}: ${error.message}`);
      }

      if (batch.length >= batchSize) {
        imported += await flushBatch({ layer, jobId: job.id, batch, lastFeatureIndex: seen });
        lastFlushedFeatureIndex = seen;
        printProgress(layer.name, seen, imported, skipped, startedAt);
      }
    }

    if (batch.length > 0) {
      imported += await flushBatch({ layer, jobId: job.id, batch, lastFeatureIndex: seen });
      lastFlushedFeatureIndex = seen;
    }

    if (!dryRun) {
      const { error } = await supabase.rpc('geo_job_complete', { p_job_id: job.id });
      if (error) {
        throw new Error(`geo_job_complete failed: ${error.message}`);
      }
    }

    printProgress(layer.name, seen, imported, skipped, startedAt, true);
  } catch (error) {
    failed = true;
    if (!dryRun && job.id) {
      await supabase.rpc('geo_job_fail', {
        p_job_id: job.id,
        p_error_message: error.message,
        p_last_feature_index: lastFlushedFeatureIndex,
      });
    }
    throw error;
  } finally {
    if (failed) {
      console.error(`[${layer.name}] failed after feature ${seen}`);
    }
  }
}

async function startJob(layer, fileName) {
  const { data, error } = await supabase.rpc('geo_job_start', {
    p_department_code: departmentCode,
    p_vintage_date: vintageDate,
    p_layer_name: layer.name,
    p_source_dir: sourceDir,
    p_source_file: fileName,
    p_metadata: {
      importer: 'scripts/import-cadastre.mjs',
      batch_size: batchSize,
    },
  });

  if (error) {
    throw new Error(`geo_job_start failed for ${layer.name}: ${error.message}`);
  }

  return Array.isArray(data) ? data[0] : data;
}

async function flushBatch({ layer, jobId, batch, lastFeatureIndex }) {
  const rows = batch.splice(0, batch.length);

  if (dryRun) {
    return rows.length;
  }

  const { data, error } = await supabase.rpc('import_geo_batch', {
    p_job_id: jobId,
    p_layer_name: layer.name,
    p_rows: rows,
    p_last_feature_index: lastFeatureIndex,
  });

  if (error) {
    throw new Error(`import_geo_batch failed for ${layer.name} at feature ${lastFeatureIndex}: ${error.message}`);
  }

  return Number(data?.processed ?? rows.length);
}

async function* streamFeatureCollection(filePath) {
  const stream = createReadStream(filePath)
    .pipe(createGunzip())
    .setEncoding('utf8');

  let prelude = '';
  let featuresStarted = false;
  let featureText = '';
  let inObject = false;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for await (const chunk of stream) {
    let input = chunk;

    if (!featuresStarted) {
      prelude += chunk;
      const keyIndex = prelude.indexOf('"features"');
      if (keyIndex === -1) {
        prelude = prelude.slice(-32);
        continue;
      }

      const arrayIndex = prelude.indexOf('[', keyIndex);
      if (arrayIndex === -1) {
        prelude = prelude.slice(keyIndex);
        continue;
      }

      input = prelude.slice(arrayIndex + 1);
      prelude = '';
      featuresStarted = true;
    }

    for (const char of input) {
      if (!inObject) {
        if (char === ']') {
          return;
        }

        if (char === '{') {
          inObject = true;
          featureText = '{';
          depth = 1;
          inString = false;
          escaped = false;
        }
        continue;
      }

      featureText += char;

      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = !inString;
      } else if (!inString && char === '{') {
        depth += 1;
      } else if (!inString && char === '}') {
        depth -= 1;
        if (depth === 0) {
          yield JSON.parse(featureText);
          featureText = '';
          inObject = false;
        }
      }
    }
  }
}

function normalizeGeometry(geometry) {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    return null;
  }

  if (geometry.type === 'Polygon') {
    return {
      type: 'MultiPolygon',
      coordinates: [geometry.coordinates],
    };
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry;
  }

  throw new Error(`Unsupported geometry type ${geometry.type}`);
}

function featureHash(feature) {
  const canonical = JSON.stringify(sortObject({
    properties: feature.properties ?? {},
    geometry: normalizeGeometry(feature.geometry),
  }));

  return createHash('sha256').update(canonical).digest('hex');
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObject(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[rawKey] = true;
      continue;
    }

    parsed[rawKey] = next;
    index += 1;
  }

  return parsed;
}

function parseLayerSelection(raw) {
  if (!raw) {
    return new Set(LAYERS.map((layer) => layer.name));
  }

  const selected = new Set(String(raw).split(',').map((layer) => layer.trim()).filter(Boolean));
  const supported = new Set(LAYERS.map((layer) => layer.name));

  for (const layer of selected) {
    if (!supported.has(layer)) {
      throw new Error(`Unsupported layer "${layer}". Supported layers: ${[...supported].join(', ')}`);
    }
  }

  return selected;
}

function printProgress(layerName, seen, imported, skipped, startedAt, final = false) {
  const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const rate = Math.round(seen / elapsedSeconds);
  const marker = final ? 'done' : 'progress';
  console.log(`[${layerName}] ${marker}: seen=${seen} imported=${imported} skipped=${skipped} rate=${rate}/s`);
}

function requiredString(value, label) {
  const normalized = stringOrNull(value);
  if (normalized === null) {
    throw new Error(`Missing ${label}`);
  }

  return normalized;
}

function stringOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value);
  return normalized.length > 0 ? normalized : null;
}

function dateOrNull(value) {
  const normalized = stringOrNull(value);
  if (!normalized) {
    return null;
  }

  validateIsoDate(normalized, 'source date');
  return normalized;
}

function integerOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.round(number);
}

function booleanOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return Boolean(value);
}

function leftPad(value, length) {
  return requiredString(value, `code padded to ${length}`).padStart(length, '0').toUpperCase();
}

function normalizeReference(value) {
  const normalized = stringOrNull(value);
  return normalized ? normalized.replace(/[^0-9A-Za-z]/g, '').toUpperCase() : null;
}

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }

  return parsed;
}

function validateIsoDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw new Error(`Invalid ${label}: ${value}. Expected YYYY-MM-DD.`);
  }
}
