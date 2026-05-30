import { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
interface GlobeEntry {
  id: string
  title: string
  path: string
  url: string
  kind: 'region' | 'country'
  depth: number
  lat: number
  lon: number
  dx: number
  dy: number
  haloRx: number
  haloRy: number
  haloCountries: string[]
}

interface HSLColor {
  h: number
  s: number
  l: number
}

interface Props {
  onNavigate?: (path: string) => void
}

// ──────────────────────────────────────────────────────────────
// TUNING — exact copy from ethno-globe.js
// ──────────────────────────────────────────────────────────────
const TUNING = {
  stage: { minSizePx: 320 },
  projection: {
    precision: 0.2,
    clipAngle: 90,
    rotate: [-12, -15, 0] as [number, number, number],
    baseScaleFactor: 0.5,
    baseScaleOffset: -8,
    minBaseScalePx: 120,
  },
  performance: {
    idleRestoreDelayMs: 220,
    interactionPrecision: 0.55,
    idlePrecision: 0.2,
    useLowResDuringInteraction: true,
    showMicrostates: false,
    microstatesDuringInteraction: false,
    microstatesMinZoom: 0.9,
    maxMicrostateMarkers: 160,
  },
  motion: {
    dragLerp: 0.34,
    dragLerpActive: 0.8,
    zoomLerp: 0.28,
    zoomLerpActive: 0.38,
    maxDtMs: 40,
    settleEpsilonDeg: 0.014,
    settleEpsilonZoom: 0.0012,
  },
  inertia: {
    enabled: true,
    decayPer60fps: 0.978,
    minVelocityDegPerMs: 0.0022,
    maxVelocityDegPerMs: 0.18,
    sampleWindowMs: 170,
    clickSuppressDistancePx: 6,
    clickSuppressMs: 120,
  },
  territoryIslands: {
    enabled: true,
    deferMs: 24,
    idleTimeoutMs: 900,
    maxRenderedFeatures: 140,
  },
  zoom: {
    min: 0.72,
    max: 2.45,
    wheelSensitivity: 0.0012,
    maxWheelStepPx: 110,
  },
  drag: {
    sensitivity: 0.24,
    minLatitude: -85,
    maxLatitude: 85,
  },
  halo: {
    sourceMapWidth: 2000,
    fallbackDegrees: 18,
    minDegrees: 10,
    maxDegrees: 76,
    fallbackCountryDegrees: 4.5,
  },
  microstates: {
    geoAreaThreshold: 0.00022,
    markerRadiusPx: 1.95,
    markerRadiusHoverPx: 2.4,
    fillAlpha: 0.62,
    strokeAlpha: 0.9,
    glowAlpha: 0.44,
    color: { h: 204, s: 38, l: 92 },
  },
  color: {
    regionFillAlpha: 0.026,
    regionStrokeAlpha: 0.12,
    regionFillHoverAlpha: 0.068,
    regionStrokeHoverAlpha: 0.28,
    countryFillAlpha: 0.19,
    countryStrokeAlpha: 0.34,
    countryFillHoverAlpha: 0.27,
    countryStrokeHoverAlpha: 0.6,
    mapCountryFillAlpha: 0.48,
    mapCountryStrokeAlpha: 0.82,
    fallbackMapCountryFill: 'rgba(13, 19, 29, 0.76)',
    fallbackMapCountryStroke: 'rgba(246, 250, 255, 0.32)',
    regionStrokeAdjust: { s: 8, l: 16 },
    regionFillHoverAdjust: { s: 8, l: 8 },
    regionStrokeHoverAdjust: { s: 20, l: 20 },
    countryStrokeAdjust: { s: 0, l: 8 },
    countryFillHoverAdjust: { s: 2, l: 8 },
    countryStrokeHoverAdjust: { s: 8, l: 12 },
    countryVariation: {
      hueSpreadCap: 16,
      hueSpreadBase: 30,
      hueJitter: 5,
      saturationBaseBoost: -8,
      saturationEdgeBoost: 1.5,
      saturationJitterBoost: 1.4,
      saturationMin: 22,
      saturationMax: 54,
      lightnessBaseShift: 10,
      lightnessIndexShift: 2.4,
      lightnessJitterShift: 1.6,
      lightnessMin: 48,
      lightnessMax: 82,
    },
  },
}

// ──────────────────────────────────────────────────────────────
// Color palette & presets — exact copy
// ──────────────────────────────────────────────────────────────
const REGION_PALETTE: HSLColor[] = [
  { h: 198, s: 58, l: 56 }, { h: 16, s: 56, l: 57 }, { h: 274, s: 48, l: 59 },
  { h: 136, s: 48, l: 55 }, { h: 44, s: 58, l: 58 }, { h: 332, s: 50, l: 58 },
  { h: 224, s: 56, l: 58 }, { h: 178, s: 48, l: 54 }, { h: 86, s: 44, l: 56 },
  { h: 256, s: 50, l: 58 }, { h: 12, s: 58, l: 58 }, { h: 206, s: 62, l: 56 },
]
const DEFAULT_REGION_COLOR: HSLColor = { h: 208, s: 52, l: 56 }
const REGION_COLOR_PRESETS: Record<string, HSLColor> = {
  'africa-subsahariana': { h: 24, s: 42, l: 52 },
  magreb: { h: 44, s: 38, l: 62 },
  'oriente-medio': { h: 47, s: 50, l: 67 },
  mediterraneo: { h: 184, s: 36, l: 51 },
  'america-latina': { h: 18, s: 56, l: 60 },
  'antilles-franceses': { h: 244, s: 40, l: 63 },
}
const COUNTRY_COLOR_PRESETS: Record<string, HSLColor> = {
  brasil: { h: 138, s: 42, l: 46 },
}
const COUNTRY_NAME_ALIASES: Record<string, string> = {
  lybia: 'libya', mauretania: 'mauritania', drc: 'dem rep congo',
  'dem rep congo': 'dem rep congo', 'democratic republic of the congo': 'dem rep congo',
  'central african republic': 'central african rep', 'central african rep': 'central african rep',
  car: 'central african rep', 'south sudan': 's sudan', 's sudan': 's sudan',
  'equatorial guinea': 'eq guinea', 'eq guinea': 'eq guinea', swaziland: 'eswatini',
  'cote d ivoire': 'cote divoire', 'ivory coast': 'cote divoire', 'cabo verde': 'cape verde',
  'sao tome and principe': 'sao tome and principe', 'dominican republic': 'dominican rep',
  'united states': 'united states of america',
  'saint vincent and the grenadines': 'st vin and gren',
  'st vincent and the grenadines': 'st vin and gren',
  'st vin and the grenadines': 'st vin and gren',
  'saint kitts and nevis': 'st kitts and nevis',
}

const TERRITORY_NAME_FIELDS = ['NAME', 'NAME_LONG', 'BRK_NAME', 'ADMIN', 'GEOUNIT', 'SUBUNIT', 'FORMAL_EN', 'ABBREV']

const WORLD_TOPO_URLS = {
  high: ['/data/countries-50m.json'],
  low: ['/data/countries-110m.json'],
}
const TERRITORY_MAP_UNITS_URLS = ['/data/territories-map-units-10m.geojson']

// ──────────────────────────────────────────────────────────────
// Globe entries — hardcoded from ethno-world-map.yaml
// In the Amethyst site these are resolved by Hugo templating.
// Here we use hash-based URLs matching the conhecimento app.
// ──────────────────────────────────────────────────────────────
function flattenYamlEntries(entries: any[]): GlobeEntry[] {
  const result: GlobeEntry[] = []
  for (const e of entries) {
    const entry: GlobeEntry = {
      id: e.id || '',
      title: e.title || '',
      path: e.path || '',
      url: `#I. Ciencia/7. Música/7.1. Etnomusicología/${e.path}/_index.md`,
      kind: e.kind === 'country' ? 'country' : 'region',
      depth: Math.max(1, Math.min(8, e.depth || 1)),
      lat: Math.max(-89.999, Math.min(89.999, e.lat || 0)),
      lon: Math.max(-180, Math.min(180, e.lon || 0)),
      dx: e.dx || 0,
      dy: e.dy || 0,
      haloRx: Math.max(0, e.halo_rx || 0),
      haloRy: Math.max(0, e.halo_ry || 0),
      haloCountries: (e.halo_countries || []).map((c: any) => String(c || '').trim()).filter(Boolean),
    }
    if (entry.id && entry.title) result.push(entry)
    if (e.children) result.push(...flattenYamlEntries(e.children))
  }
  return result
}

const GLOBE_DATA_RAW = [
  {
    id: 'africa-subsahariana', title: 'África subsahariana', path: '1. África subsahariana',
    kind: 'region', depth: 1, lat: -3.0, lon: -15.0, dx: 12, dy: -20,
    halo_rx: 420, halo_ry: 260,
    halo_countries: [
      'South Africa', 'Lesotho', 'eSwatini', 'Namibia', 'Botswana', 'Zimbabwe', 'Mozambique',
      'Zambia', 'Malawi', 'Angola', 'Congo', 'Democratic Republic of the Congo', 'Gabon',
      'Cameroon', 'Central African Republic', 'Chad', 'Sudan', 'South Sudan', 'Eritrea',
      'Ethiopia', 'Djibouti', 'Somalia', 'Kenya', 'Tanzania', 'Uganda', 'Rwanda', 'Burundi',
      'Ghana', 'Togo', 'Benin', 'Nigeria', "Côte d'Ivoire", 'Liberia', 'Sierra Leone',
      'Guinea', 'Guinea-Bissau', 'Equatorial Guinea', 'Senegal', 'Gambia', 'Mali', 'Niger',
      'Burkina Faso', 'Cape Verde', 'Sao Tome and Principe', 'Comoros', 'Seychelles',
      'Mauritius', 'Madagascar',
    ],
  },
  {
    id: 'oriente-medio', title: 'Oriente Medio', path: '2. Oriente Medio',
    kind: 'region', depth: 1, lat: 30.0, lon: 45.0, dx: 5, dy: -8,
    halo_rx: 220, halo_ry: 120,
    halo_countries: [
      'Iran', 'Syria', 'Iraq', 'Lebanon', 'Israel', 'Jordan', 'Saudi Arabia', 'Yemen',
      'Oman', 'United Arab Emirates', 'Qatar', 'Bahrain', 'Egypt', 'Azerbaijan', 'Armenia',
      'Georgia', 'Greece', 'Turkey', 'Cyprus',
    ],
    children: [
      { id: 'iran', title: 'Irán', path: '2. Oriente Medio/Irán', kind: 'country', depth: 2, lat: 32.0, lon: 53.0, dx: 0, dy: -8 },
      {
        id: 'arabe', title: 'Árabe', path: '2. Oriente Medio/Árabe', kind: 'region', depth: 2,
        lat: 24.0, lon: 45.0, dx: 10, dy: 14, halo_rx: 180, halo_ry: 100,
        halo_countries: ['Saudi Arabia', 'Yemen', 'Oman', 'United Arab Emirates', 'Qatar', 'Bahrain', 'Egypt', 'Jordan', 'Iraq', 'Syria', 'Lebanon', 'Kuwait'],
      },
      {
        id: 'magreb', title: 'Magreb', path: '2. Oriente Medio/Magreb', kind: 'region', depth: 2,
        lat: 31.0, lon: -6.0, dx: -62, dy: -10, halo_rx: 190, halo_ry: 95,
        halo_countries: ['Mauritania', 'Western Sahara', 'Morocco', 'Algeria', 'Tunisia', 'Libya'],
      },
    ],
  },
  {
    id: 'mediterraneo', title: 'Mediterráneo', path: '3. Mediterráneo',
    kind: 'region', depth: 1, lat: 38.0, lon: 15.0, dx: 12, dy: -10,
    halo_rx: 300, halo_ry: 95,
    halo_countries: ['Spain', 'Portugal', 'France', 'Italy'],
    children: [
      { id: 'espana', title: 'España', path: '3. Mediterráneo/España', kind: 'country', depth: 2, lat: 43.0, lon: -4.0, dx: -58, dy: -8 },
      { id: 'portugal', title: 'Portugal', path: '3. Mediterráneo/Portugal', kind: 'country', depth: 2, lat: 39.0, lon: -8.0, dx: -40, dy: 8 },
    ],
  },
  {
    id: 'america-latina', title: 'América Latina', path: '4. América/4.1. América Latina',
    kind: 'region', depth: 2, lat: 5.0, lon: -43.0, dx: 0, dy: 0,
    halo_rx: 360, halo_ry: 260,
    halo_countries: [
      'Mexico', 'Guatemala', 'El Salvador', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panama',
      'Cuba', 'Haiti', 'Dominican Republic', 'Trinidad and Tobago', 'Colombia', 'Venezuela',
      'Ecuador', 'Peru', 'Bolivia', 'Paraguay', 'Chile', 'Argentina', 'Uruguay',
    ],
    children: [
      { id: 'mexico', title: 'México', path: '4. América/4.1. América Latina/4.1.1. Hispanoamérica/México', kind: 'country', depth: 4, lat: 23.6, lon: -102.5, dx: -10, dy: -12 },
      { id: 'cuba', title: 'Cuba', path: '4. América/4.1. América Latina/4.1.1. Hispanoamérica/Cuba', kind: 'country', depth: 4, lat: 21.5, lon: -79.5, dx: 10, dy: -35 },
      { id: 'santo-domingo', title: 'Santo Domingo', path: '4. América/4.1. América Latina/4.1.1. Hispanoamérica/Santo Domingo', kind: 'country', depth: 4, lat: 18.9, lon: -70.4, dx: 12, dy: 14 },
      { id: 'puerto-rico', title: 'Puerto Rico', path: '4. América/4.1. América Latina/4.1.1. Hispanoamérica/Puerto Rico', kind: 'country', depth: 4, lat: 18.2, lon: -66.5, dx: 12, dy: -12 },
      { id: 'colombia', title: 'Colombia', path: '4. América/4.1. América Latina/4.1.1. Hispanoamérica/Colombia', kind: 'country', depth: 4, lat: 4.6, lon: -74.1, dx: 10, dy: -10 },
      { id: 'ecuador', title: 'Ecuador', path: '4. América/4.1. América Latina/4.1.1. Hispanoamérica/Ecuador', kind: 'country', depth: 4, lat: -1.8, lon: -78.2, dx: -10, dy: 14 },
      { id: 'peru', title: 'Perú', path: '4. América/4.1. América Latina/4.1.1. Hispanoamérica/Perú', kind: 'country', depth: 4, lat: -9.2, lon: -75.0, dx: 10, dy: 16 },
      { id: 'brasil', title: 'Brasil', path: '4. América/4.1. América Latina/4.1.2. Brasil', kind: 'country', depth: 3, lat: -14.2, lon: -51.9, dx: 0, dy: -40 },
      {
        id: 'antilles-franceses', title: 'Antilles françaises', path: '4. América/4.1. América Latina/4.1.3. Antilles françaises',
        kind: 'region', depth: 3, lat: 16.4, lon: -61.4, dx: 12, dy: -12,
        halo_rx: 140, halo_ry: 85,
        halo_countries: ['Haiti', 'Martinique', 'Guadeloupe', 'St-Martin', 'St-Barthélemy'],
        children: [
          { id: 'martinique', title: 'Martinique', path: '4. América/4.1. América Latina/Antilles françaises/Martinique', kind: 'country', depth: 4, lat: 14.64, lon: -61.02, dx: 10, dy: -10 },
        ],
      },
    ],
  },
]

const ENTRIES = flattenYamlEntries(GLOBE_DATA_RAW)

// ──────────────────────────────────────────────────────────────
// Utility functions — exact copies from ethno-globe.js
// ──────────────────────────────────────────────────────────────
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

const stripAccents = (v: string) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const normalizePath = (v: string) =>
  stripAccents(v).replace(/\\/g, '/').split('/').map(s => s.trim().toLowerCase()).filter(Boolean).join('/')

const normalizeCountryName = (v: string) =>
  stripAccents(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')

const canonicalCountryName = (v: string) => {
  const n = normalizeCountryName(v)
  return COUNTRY_NAME_ALIASES[n] || n
}

const toDomIdSegment = (v: string, fb = 'entry') => {
  const n = String(v || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return n || fb
}

const toHsla = (c: HSLColor, a: number) => `hsla(${c.h}, ${c.s}%, ${c.l}%, ${a})`
const adjustColor = (c: HSLColor, sD: number, lD: number): HSLColor => ({
  h: c.h, s: clamp(c.s + sD, 20, 90), l: clamp(c.l + lD, 20, 84),
})
const wrapHue = (v: number) => { const n = v % 360; return n < 0 ? n + 360 : n }
const hashString = (v: string) => {
  let h = 2166136261; const s = String(v || '')
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24) }
  return h >>> 0
}
const signedHashUnit = (v: string) => (hashString(v) % 2001) / 1000 - 1

const deriveCountryColor = (rc: HSLColor, cid: string, idx: number, cnt: number): HSLColor => {
  const v = TUNING.color.countryVariation; const c = Math.max(1, cnt)
  const ni = c === 1 ? 0 : (idx / (c - 1)) * 2 - 1
  const j = signedHashUnit(`${cid}:${c}`)
  const hs = Math.min(v.hueSpreadCap, v.hueSpreadBase / Math.sqrt(c))
  const hShift = ni * hs + j * v.hueJitter
  const sB = v.saturationBaseBoost + Math.abs(ni) * v.saturationEdgeBoost + (j + 1) * v.saturationJitterBoost
  const lS = v.lightnessBaseShift + ni * v.lightnessIndexShift + j * v.lightnessJitterShift
  return { h: wrapHue(rc.h + hShift), s: clamp(rc.s + sB, v.saturationMin, v.saturationMax), l: clamp(rc.l + lS, v.lightnessMin, v.lightnessMax) }
}

const resolveCountryRegion = (ce: GlobeEntry, regions: any[]) => {
  const cp = normalizePath(ce.path); let best: any = null
  for (const r of regions) {
    if (!r.normalizedPath) continue
    if (cp === r.normalizedPath || cp.startsWith(`${r.normalizedPath}/`)) {
      if (!best || r.normalizedPath.length > best.normalizedPath.length) best = r
    }
  }
  if (best) return best
  let nearest: any = null, ns = Infinity
  for (const r of regions) {
    const ld = ce.lat - r.lat, lnd = ce.lon - r.lon, sc = ld * ld + lnd * lnd
    if (sc < ns) { ns = sc; nearest = r }
  }
  return nearest
}

const regionRadiusDegrees = (e: GlobeEntry) => {
  const avg = (e.haloRx + e.haloRy) / 2
  const conv = (avg / TUNING.halo.sourceMapWidth) * 360
  return clamp(conv || TUNING.halo.fallbackDegrees, TUNING.halo.minDegrees, TUNING.halo.maxDegrees)
}

const isPointVisible = (proj: d3.GeoProjection, lon: number, lat: number) => {
  const r = proj.rotate(); const c = [-r[0], -r[1]] as [number, number]
  return d3.geoDistance([lon, lat], c) <= Math.PI / 2
}

const featureNameCandidates = (f: any) => {
  const p = f?.properties || {}
  return [p.name, ...TERRITORY_NAME_FIELDS.map(k => p[k]), p.NAME_EN, p.NAME_SORT, p.WIKIDATAID]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map(v => v.trim())
}

const buildFeatureKey = (f: any, fb = '') => {
  const id = String(f?.id || '').trim(); if (id) return id
  const fn = featureNameCandidates(f)[0]; if (fn) return canonicalCountryName(fn)
  return fb
}

const buildWorldFeatureIndex = (features: any[]) => {
  const byId = new Map<string, any>(); const byName = new Map<string, any>(); const byNameAll = new Map<string, any[]>()
  const addByName = (n: string, f: any) => {
    if (!n) return; if (!byName.has(n)) byName.set(n, f)
    const b = byNameAll.get(n) || []; const k = buildFeatureKey(f)
    if (!b.some(i => buildFeatureKey(i) === k)) { b.push(f); byNameAll.set(n, b) }
  }
  features.forEach((f, i) => {
    const fk = buildFeatureKey(f, `feature-${i}`)
    if (fk && !byId.has(fk)) byId.set(fk, f)
    featureNameCandidates(f).map(n => canonicalCountryName(n)).filter(Boolean).forEach(n => addByName(n, f))
  })
  return { byId, byName, byNameAll }
}

const mergeFeatureIndexes = (...idxs: any[]) => {
  const byId = new Map(); const byName = new Map(); const byNameAll = new Map()
  const addF = (f: any) => { const k = buildFeatureKey(f); if (k && !byId.has(k)) byId.set(k, f) }
  const addN = (n: string, f: any) => {
    if (!n) return; if (!byName.has(n)) byName.set(n, f)
    const b = byNameAll.get(n) || []; const k = buildFeatureKey(f)
    if (!b.some((i: any) => buildFeatureKey(i) === k)) { b.push(f); byNameAll.set(n, b) }
  }
  idxs.forEach(idx => {
    if (!idx) return
    ;(idx.byId || new Map()).forEach((f: any) => addF(f))
    ;(idx.byNameAll || new Map()).forEach((fs: any[], n: string) => fs.forEach(f => addN(n, f)))
    ;(idx.byName || new Map()).forEach((f: any, n: string) => addN(n, f))
  })
  return { byId, byName, byNameAll }
}

const findCountryFeatureForEntry = (entry: GlobeEntry, features: any[]) => {
  const pt: [number, number] = [entry.lon, entry.lat]
  const containing = features.find(f => d3.geoContains(f, pt))
  if (containing) return containing
  let nearest: any = null, nd = Infinity
  for (const f of features) {
    const c = d3.geoCentroid(f); const dist = d3.geoDistance(pt, c)
    if (dist < nd) { nd = dist; nearest = f }
  }
  return nearest
}

const resolveRegionHaloGeometry = (re: any, ces: any[], wfi: any, wd: any) => {
  const features: any[] = []; const seen = new Set<string>()
  const push = (f: any) => {
    if (!f) return; const k = buildFeatureKey(f); if (!k || seen.has(k)) return; seen.add(k); features.push(f)
  }
  if (re.haloCountries.length > 0) {
    re.haloCountries.forEach((c: string) => {
      const idM = wfi.byId.get(String(c).trim()); if (idM) { push(idM); return }
      const cn = canonicalCountryName(c); const nm = wfi.byNameAll?.get(cn)
      if (Array.isArray(nm) && nm.length > 0) { nm.forEach((f: any) => push(f)); return }
      const nM = wfi.byName.get(cn); if (nM) push(nM)
    })
  }
  if (features.length === 0) {
    const prefix = re.normalizedPath ? `${re.normalizedPath}/` : ''
    ces.forEach((e: any) => {
      if (!e.hasWorldShape || !re.normalizedPath) return
      if (e.normalizedPath === re.normalizedPath || e.normalizedPath.startsWith(prefix)) push(e.shape)
    })
  }
  if (features.length === 0) return null

  const canMerge = !!(wd && wd.topology && wd.geometryById && typeof topojson.merge === 'function')
  if (canMerge) {
    const geometries: any[] = []; const seenG = new Set<string>(); const suppl: any[] = []
    features.forEach(f => {
      if (f?.__ethnoSupplemental) { suppl.push(f); return }
      const id = String(f?.id || '').trim()
      if (!id || seenG.has(id)) { if (f?.geometry) suppl.push(f); return }
      const g = wd.geometryById.get(id)
      if (!g) { if (f?.geometry) suppl.push(f); return }
      seenG.add(id); geometries.push(g)
    })
    if (geometries.length > 0) {
      const merged = topojson.merge(wd.topology, geometries)
      if (merged) {
        if (suppl.length === 0) return merged
        return { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, properties: {}, geometry: merged }, ...suppl] }
      }
    }
  }
  return { type: 'FeatureCollection' as const, features }
}

// ──────────────────────────────────────────────────────────────
// Fetch helpers
// ──────────────────────────────────────────────────────────────
const fetchFirstJson = async (urls: string[]) => {
  for (const url of urls) {
    try {
      const r = await fetch(url); if (!r.ok) continue; return r.json()
    } catch { /* next */ }
  }
  throw new Error('Failed to load topology')
}

const buildWorldData = (topo: any) => {
  const co = topo?.objects?.countries; if (!co) throw new Error('Missing countries object')
  const features = topojson.feature(topo, co).features || []
  const geometryById = new Map(
    (Array.isArray(co.geometries) ? co.geometries : [])
      .map((g: any) => [String(g?.id || '').trim(), g] as [string, any])
      .filter(([id]: [string, any]) => id)
  )
  const borders = topojson.mesh(topo, co, (a: any, b: any) => a !== b)
  const coastline = topojson.merge(topo, Array.isArray(co.geometries) ? co.geometries : [])
  const featureIndex = buildWorldFeatureIndex(features)
  return { topology: topo, features, borders, coastline, geometryById, featureIndex }
}

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────
export default function EthnoGlobe({ onNavigate }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const teardownRef = useRef<(() => void) | null>(null)

  const handleNavigate = useCallback((url: string) => {
    if (onNavigate && url.startsWith('#')) {
      onNavigate(url.slice(1))
    } else if (url.startsWith('#')) {
      window.location.hash = url
    }
  }, [onNavigate])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    let cancelled = false

    const init = async () => {
      try {
        let worldData = await fetchFirstJson(WORLD_TOPO_URLS.low).then(buildWorldData)
        if (cancelled) return

        stage.innerHTML = ''

        const svg = d3.select(stage)
          .append('svg')
          .attr('class', 'ethno-globe-svg')
          .attr('role', 'img')
          .attr('aria-label', 'Interactive ethnomusicology globe')

        svg.append('rect').attr('class', 'ethno-globe-backdrop')

        let suppressClickUntil = 0
        const shouldSuppressClick = () => Date.now() < suppressClickUntil

        const viewport = svg.append('g').attr('class', 'ethno-globe-viewport')
        const spherePath = viewport.append('path').attr('class', 'ethno-globe-sphere')
        const countriesGroup = viewport.append('g').attr('class', 'ethno-globe-countries')
        let countryPaths: any = null
        const bordersPath = viewport.append('path').attr('class', 'ethno-globe-borders')
        const coastlinePath = viewport.append('path').attr('class', 'ethno-globe-coastline')
        const territoryIslandsGroup = viewport.append('g').attr('class', 'ethno-globe-territory-islands')
        let territoryIslandPaths: any = null
        let territoryIslandFeatures: any[] = []
        const interactionGroup = viewport.append('g').attr('class', 'ethno-globe-interactions')
        const regionGroup = interactionGroup.append('g').attr('class', 'ethno-globe-region-links')
        const countryGroup = interactionGroup.append('g').attr('class', 'ethno-globe-country-links')
        const labelsGroup = viewport.append('g').attr('class', 'ethno-globe-labels')

        const projection = d3.geoOrthographic()
          .precision(TUNING.performance.idlePrecision)
          .clipAngle(TUNING.projection.clipAngle)
          .rotate(TUNING.projection.rotate)
        const path = d3.geoPath(projection)
        const sphere: d3.GeoPermissibleObjects = { type: 'Sphere' }

        const entries = ENTRIES

        // Seed regions
        const seededRegions = entries
          .filter(e => e.kind === 'region')
          .map((e, i) => ({
            ...e,
            normalizedPath: normalizePath(e.path),
            color: REGION_COLOR_PRESETS[e.id] || REGION_PALETTE[i % REGION_PALETTE.length] || DEFAULT_REGION_COLOR,
          }))

        // Seed countries
        const countryColorById = new Map<string, HSLColor>()
        const seededCountries = entries
          .filter(e => e.kind === 'country')
          .map((e, i) => {
            const pr = resolveCountryRegion(e, seededRegions)
            const ic = pr?.color || REGION_PALETTE[(seededRegions.length + i) % REGION_PALETTE.length] || DEFAULT_REGION_COLOR
            const rc = COUNTRY_COLOR_PRESETS[e.id] || ic
            return { ...e, normalizedPath: normalizePath(e.path), regionId: pr?.id || '', regionColor: rc }
          })

        const countriesByRegion = new Map<string, typeof seededCountries>()
        seededCountries.forEach(e => {
          const k = e.regionId || '__fallback__'
          if (!countriesByRegion.has(k)) countriesByRegion.set(k, [])
          countriesByRegion.get(k)!.push(e)
        })

        const coloredCountries: any[] = []
        countriesByRegion.forEach(bucket => {
          const sorted = bucket.slice().sort((a, b) => a.id.localeCompare(b.id))
          sorted.forEach((e, i) => coloredCountries.push({ ...e, color: deriveCountryColor(e.regionColor, e.id, i, sorted.length) }))
        })

        const countryEntries = coloredCountries.map(e => {
          if (worldData) {
            const f = findCountryFeatureForEntry(e, worldData.features)
            if (f) {
              const fid = String(f?.id || '').trim()
              if (fid) countryColorById.set(fid, e.color)
              return { ...e, shape: f, hasWorldShape: true }
            }
          }
          return { ...e, shape: d3.geoCircle().center([e.lon, e.lat]).radius(TUNING.halo.fallbackCountryDegrees)(), hasWorldShape: false }
        })

        const baseWorldFeatureIndex = worldData.featureIndex || buildWorldFeatureIndex(worldData.features)
        let combinedWorldFeatureIndex = baseWorldFeatureIndex

        const regionEntries = seededRegions.map(e => ({
          ...e,
          geometry: d3.geoCircle().center([e.lon, e.lat]).radius(regionRadiusDegrees(e))() as any,
        }))

        const instanceId = `ethno-globe-${Date.now()}`
        const regionHaloMaskIdByEntryId = new Map(
          regionEntries.map((e, i) => [e.id, `${instanceId}-rhm-${i}-${toDomIdSegment(e.id, 'r')}`])
        )
        const regionHaloMaskWorldExtent = 4096
        const regionHaloInwardBleedPx = 1.4

        const recomputeRegionGeometries = () => {
          regionEntries.forEach(e => {
            let g: any = d3.geoCircle().center([e.lon, e.lat]).radius(regionRadiusDegrees(e))()
            if (combinedWorldFeatureIndex) {
              const rg = resolveRegionHaloGeometry(e, countryEntries, combinedWorldFeatureIndex, worldData)
              if (rg) g = rg
            }
            e.geometry = g
          })
        }
        recomputeRegionGeometries()

        const referencedHaloNames = new Set<string>()
        seededRegions.forEach(e => (e.haloCountries || []).forEach(c => {
          const cn = canonicalCountryName(c); if (cn) referencedHaloNames.add(cn)
        }))

        // SVG defs + masks
        const defs = svg.append('defs')
        const regionHaloMasks = defs
          .selectAll<SVGMaskElement, any>('mask.ethno-globe-region-halo-mask')
          .data(regionEntries, (d: any) => d.id)
          .enter().append('mask')
          .attr('class', 'ethno-globe-region-halo-mask')
          .attr('id', (d: any) => regionHaloMaskIdByEntryId.get(d.id)!)
          .attr('maskUnits', 'userSpaceOnUse').attr('maskContentUnits', 'userSpaceOnUse')
          .attr('x', -regionHaloMaskWorldExtent).attr('y', -regionHaloMaskWorldExtent)
          .attr('width', regionHaloMaskWorldExtent * 2).attr('height', regionHaloMaskWorldExtent * 2)

        regionHaloMasks.append('rect')
          .attr('x', -regionHaloMaskWorldExtent).attr('y', -regionHaloMaskWorldExtent)
          .attr('width', regionHaloMaskWorldExtent * 2).attr('height', regionHaloMaskWorldExtent * 2)
          .attr('fill', '#fff')

        const regionHaloMaskCutouts = regionHaloMasks.append('path').attr('fill', '#000')
        const regionHaloMaskEdgeRestores = regionHaloMasks.append('path')
          .attr('fill', 'none').attr('stroke', '#fff')
          .attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round')
          .attr('stroke-width', regionHaloInwardBleedPx)

        // Region links
        const C = TUNING.color
        const regionLinks = regionGroup
          .selectAll<SVGAElement, any>('a')
          .data(regionEntries, (d: any) => d.id)
          .enter().append('a')
          .attr('class', (d: any) => `ethno-globe-link region depth-${d.depth}`)
          .attr('href', (d: any) => d.url)
          .attr('aria-label', (d: any) => d.title)
          .attr('data-entry-id', (d: any) => d.id)
          .attr('data-entry-kind', () => 'region')
          .style('--ethno-region-fill', (d: any) => toHsla(d.color, C.regionFillAlpha))
          .style('--ethno-region-stroke', (d: any) => toHsla(adjustColor(d.color, C.regionStrokeAdjust.s, C.regionStrokeAdjust.l), C.regionStrokeAlpha))
          .style('--ethno-region-fill-hover', (d: any) => toHsla(adjustColor(d.color, C.regionFillHoverAdjust.s, C.regionFillHoverAdjust.l), C.regionFillHoverAlpha))
          .style('--ethno-region-stroke-hover', (d: any) => toHsla(adjustColor(d.color, C.regionStrokeHoverAdjust.s, C.regionStrokeHoverAdjust.l), C.regionStrokeHoverAlpha))
          .style('--ethno-region-hit-fill', (d: any) => toHsla(d.color, Math.max(0.005, C.regionFillAlpha * 0.3)))
          .style('--ethno-region-hit-fill-hover', (d: any) => toHsla(d.color, Math.max(0.01, C.regionFillHoverAlpha * 0.42)))
          .style('--ethno-region-glow', (d: any) => toHsla(adjustColor(d.color, C.regionStrokeHoverAdjust.s, C.regionStrokeHoverAdjust.l), Math.min(0.28, C.regionStrokeHoverAlpha)))
          .on('click', (event: any, d: any) => {
            if (shouldSuppressClick()) { event.preventDefault(); event.stopPropagation(); return }
            event.preventDefault(); handleNavigate(d.url)
          })
          .on('pointerenter', (_: any, d: any) => setActiveEntry(d))
          .on('pointerleave', () => setActiveEntry(null))
          .on('focus', (_: any, d: any) => setActiveEntry(d))
          .on('blur', () => setActiveEntry(null))

        regionLinks.append('path').attr('class', 'ethno-globe-region-halo')
          .attr('mask', (d: any) => `url(#${regionHaloMaskIdByEntryId.get(d.id)})`)
        regionLinks.append('path').attr('class', 'ethno-globe-region-hit')

        // Country links
        const countryLinks = countryGroup
          .selectAll<SVGAElement, any>('a')
          .data(countryEntries, (d: any) => d.id)
          .enter().append('a')
          .attr('class', (d: any) => `ethno-globe-link country depth-${d.depth}`)
          .attr('href', (d: any) => d.url)
          .attr('aria-label', (d: any) => d.title)
          .attr('data-entry-id', (d: any) => d.id)
          .attr('data-entry-kind', () => 'country')
          .style('--ethno-country-fill', (d: any) => toHsla(d.color, C.countryFillAlpha))
          .style('--ethno-country-stroke', (d: any) => toHsla(adjustColor(d.color, C.countryStrokeAdjust.s, C.countryStrokeAdjust.l), C.countryStrokeAlpha))
          .style('--ethno-country-fill-hover', (d: any) => toHsla(adjustColor(d.color, C.countryFillHoverAdjust.s, C.countryFillHoverAdjust.l), C.countryFillHoverAlpha))
          .style('--ethno-country-stroke-hover', (d: any) => toHsla(adjustColor(d.color, C.countryStrokeHoverAdjust.s, C.countryStrokeHoverAdjust.l), C.countryStrokeHoverAlpha))
          .on('click', (event: any, d: any) => {
            if (shouldSuppressClick()) { event.preventDefault(); event.stopPropagation(); return }
            event.preventDefault(); handleNavigate(d.url)
          })
          .on('pointerenter', (_: any, d: any) => setActiveEntry(d))
          .on('pointerleave', () => setActiveEntry(null))
          .on('focus', (_: any, d: any) => setActiveEntry(d))
          .on('blur', () => setActiveEntry(null))

        countryLinks.append('path')

        // Labels
        const labelEntries = [...regionEntries, ...countryEntries]
        const entryById = new Map(labelEntries.map(e => [e.id, e]))
        const labelTextAnchor = (e: any) => (e.dx > 8 ? 'start' : e.dx < -8 ? 'end' : 'middle')
        let labelLinks = labelsGroup.selectAll<SVGAElement, any>('a.ethno-globe-label-link')
        let activeEntryId = ''

        const syncActiveClasses = () => {
          const isA = (d: any) => !!activeEntryId && d?.id === activeEntryId
          regionLinks.classed('is-linked-hover', (d: any) => isA(d))
          countryLinks.classed('is-linked-hover', (d: any) => isA(d))
          labelLinks.classed('is-linked-hover', (d: any) => isA(d))
        }

        const setActiveEntry = (entryOrNull: any) => {
          activeEntryId = entryOrNull?.id || ''
          syncActiveClasses()
        }

        const syncLabelChipGeometry = (node: SVGAElement, entry: any) => {
          if (!node) return
          const link = d3.select(node)
          const labelText = link.select<SVGTextElement>('text')
            .attr('class', `depth-${entry.depth}`)
            .attr('text-anchor', labelTextAnchor(entry))
            .attr('dominant-baseline', 'middle')
            .attr('x', 0).attr('y', 0)
            .text(entry.title)
          const textNode = labelText.node()
          if (!textNode || typeof textNode.getBBox !== 'function') return
          let bounds; try { bounds = textNode.getBBox() } catch { return }
          const padX = 12, padY = 6, cornerRadius = 10
          link.select('rect')
            .attr('x', bounds.x - padX).attr('y', bounds.y - padY)
            .attr('width', Math.max(0, bounds.width + padX * 2))
            .attr('height', Math.max(0, bounds.height + padY * 2))
            .attr('rx', cornerRadius).attr('ry', cornerRadius)
        }

        // State
        let width = 0, height = 0, baseScale = 1
        let zoomScale = 1, zoomTarget = 1
        let isInteracting = false, idleTimer: any = null
        let redrawFrame = 0, motionFrame = 0, lastMotionTs = 0
        let activeWorldData = worldData
        let isDragging = false, isInertiaActive = false
        let dragOrigin: [number, number] | null = null, dragRotateStart: number[] | null = null
        let dragDistancePx = 0
        let angularVelocity = { lambda: 0, phi: 0 }
        const dragSamples: any[] = []
        const iR = projection.rotate()
        let rotationCurrent = [iR[0] || 0, clamp(iR[1] || 0, TUNING.drag.minLatitude, TUNING.drag.maxLatitude), iR[2] || 0]
        let rotationTarget = rotationCurrent.slice()

        const applyScale = () => projection.scale(baseScale * zoomScale)
        const clearIdleTimer = () => { if (idleTimer) { clearTimeout(idleTimer); idleTimer = null } }
        const cancelQueuedRedraw = () => { if (redrawFrame) { cancelAnimationFrame(redrawFrame); redrawFrame = 0 } }
        const cancelMotionFrame = () => { if (motionFrame) { cancelAnimationFrame(motionFrame); motionFrame = 0 } }
        const normalizeLongitude = (v: number) => { const n = ((v + 180) % 360 + 360) % 360 - 180; return n === -180 ? 180 : n }
        const shortestAngularDelta = (f: number, t: number) => { let d = t - f; while (d > 180) d -= 360; while (d < -180) d += 360; return d }
        const clearDragSamples = () => { dragSamples.length = 0 }
        const pushDragSample = (ts: number) => {
          dragSamples.push({ t: ts, lambda: rotationTarget[0], phi: rotationTarget[1] })
          const ws = ts - Math.max(40, TUNING.inertia.sampleWindowMs * 2)
          while (dragSamples.length > 0 && dragSamples[0].t < ws) dragSamples.shift()
        }
        const stopInertia = () => { isInertiaActive = false; angularVelocity = { lambda: 0, phi: 0 } }
        const computeReleaseVelocity = () => {
          if (dragSamples.length < 2) return { lambda: 0, phi: 0 }
          const latest = dragSamples[dragSamples.length - 1]
          const cutoff = latest.t - Math.max(20, TUNING.inertia.sampleWindowMs)
          const w = dragSamples.filter(s => s.t >= cutoff)
          if (w.length < 2) return { lambda: 0, phi: 0 }
          const first = w[0], last = w[w.length - 1], dt = Math.max(1, last.t - first.t)
          const maxV = Math.max(TUNING.inertia.minVelocityDegPerMs, TUNING.inertia.maxVelocityDegPerMs)
          return {
            lambda: clamp(shortestAngularDelta(first.lambda, last.lambda) / dt, -maxV, maxV),
            phi: clamp((last.phi - first.phi) / dt, -maxV, maxV),
          }
        }

        const fillForFeature = (f: any) => {
          const fid = String(f?.id || '').trim()
          const c = fid ? countryColorById.get(fid) : null
          return c ? toHsla(c, C.mapCountryFillAlpha) : C.fallbackMapCountryFill
        }
        const strokeForFeature = (f: any) => {
          const fid = String(f?.id || '').trim()
          const c = fid ? countryColorById.get(fid) : null
          return c ? toHsla(adjustColor(c, 12, 16), C.mapCountryStrokeAlpha) : C.fallbackMapCountryStroke
        }

        const bindActiveWorldData = () => {
          const features = activeWorldData?.features || []
          countryPaths = countriesGroup.selectAll('path')
            .data(features, (f: any, i: number) => String(f?.id || '').trim() || `feature-${i}`)
            .join(
              enter => enter.append('path').attr('class', 'ethno-globe-country'),
              update => update,
              exit => exit.remove(),
            )
            .attr('fill', (f: any) => fillForFeature(f))
            .attr('stroke', (f: any) => strokeForFeature(f))
        }

        const bindTerritoryIslandFeatures = () => {
          territoryIslandPaths = territoryIslandsGroup.selectAll('path')
            .data(territoryIslandFeatures, (f: any, i: number) => buildFeatureKey(f, `territory-${i}`))
            .join(
              enter => enter.append('path').attr('class', 'ethno-globe-territory-island'),
              update => update, exit => exit.remove(),
            )
        }

        const requestRedraw = () => {
          if (redrawFrame) return
          redrawFrame = requestAnimationFrame(() => { redrawFrame = 0; redraw() })
        }

        const redraw = () => {
          spherePath.attr('d', path(sphere))
          if (countryPaths) countryPaths.attr('d', (f: any) => path(f))
          if (territoryIslandPaths) territoryIslandPaths.attr('d', (f: any) => path(f))

          if (bordersPath && activeWorldData?.borders) bordersPath.attr('d', path(activeWorldData.borders))
          else bordersPath.attr('d', null)
          if (coastlinePath && activeWorldData?.coastline) coastlinePath.attr('d', path(activeWorldData.coastline))
          else coastlinePath.attr('d', null)
          regionHaloMaskCutouts.attr('d', (d: any) => path(d.geometry))
          regionHaloMaskEdgeRestores.attr('d', (d: any) => path(d.geometry))
          regionLinks.selectAll('.ethno-globe-region-halo').attr('d', (d: any) => path(d.geometry))
          regionLinks.selectAll('.ethno-globe-region-hit').attr('d', (d: any) => path(d.geometry))
          countryLinks.select('path').attr('d', (d: any) => path(d.shape))

          const visibleLabels = labelEntries
            .map(e => {
              const p = projection([e.lon, e.lat]); if (!p) return null
              if (!isPointVisible(projection, e.lon, e.lat)) return null
              return { ...e, x: p[0] + e.dx, y: p[1] + e.dy }
            }).filter(Boolean)

          labelLinks = labelsGroup
            .selectAll<SVGAElement, any>('a.ethno-globe-label-link')
            .data(visibleLabels as any[], (d: any) => d.id)
            .join(
              enter => enter.append('a')
                .attr('class', 'ethno-globe-label-link')
                .on('pointerdown', (e: any) => e.stopPropagation())
                .on('mousedown', (e: any) => e.stopPropagation())
                .on('touchstart', (e: any) => e.stopPropagation())
                .on('click', (event: any, d: any) => {
                  if (shouldSuppressClick()) { event.preventDefault(); event.stopPropagation(); return }
                  event.preventDefault(); handleNavigate(d.url)
                })
                .on('pointerenter', (_: any, d: any) => setActiveEntry(d))
                .on('pointerleave', () => setActiveEntry(null))
                .on('focus', (_: any, d: any) => setActiveEntry(d))
                .on('blur', () => setActiveEntry(null))
                .call(sel => { sel.append('rect').attr('class', 'ethno-globe-label-chip'); sel.append('text') }),
              update => update, exit => exit.remove(),
            )
            .attr('href', (d: any) => d.url)
            .attr('aria-label', (d: any) => d.title)
            .attr('data-entry-id', (d: any) => d.id)
            .attr('data-entry-kind', (d: any) => d.kind)
            .style('--ethno-label-accent', (d: any) => toHsla(adjustColor(d.color, C.countryStrokeHoverAdjust.s, C.countryStrokeHoverAdjust.l), 0.96))
            .style('--ethno-label-chip-glow', (d: any) => toHsla(adjustColor(d.color, C.countryStrokeHoverAdjust.s, C.countryStrokeHoverAdjust.l), 0.24))

          labelLinks.attr('transform', (d: any) => `translate(${d.x},${d.y})`).each(function (this: SVGAElement, d: any) {
            syncLabelChipGeometry(this, d)
          })
          syncActiveClasses()
        }

        const applyInteractionMode = () => {
          projection.precision(isInteracting ? TUNING.performance.interactionPrecision : TUNING.performance.idlePrecision)
          stage.classList.toggle('is-interacting', isInteracting)
          requestRedraw()
        }

        const enterInteraction = () => {
          clearIdleTimer()
          if (!isInteracting) { isInteracting = true; applyInteractionMode() }
          else stage.classList.add('is-interacting')
        }

        const scheduleIdleRestore = () => {
          clearIdleTimer()
          idleTimer = setTimeout(() => { idleTimer = null; isInteracting = false; applyInteractionMode() }, TUNING.performance.idleRestoreDelayMs)
        }

        const hasPendingRotation = () =>
          Math.abs(shortestAngularDelta(rotationCurrent[0], rotationTarget[0])) > TUNING.motion.settleEpsilonDeg ||
          Math.abs(rotationTarget[1] - rotationCurrent[1]) > TUNING.motion.settleEpsilonDeg
        const hasPendingZoom = () => Math.abs(zoomTarget - zoomScale) > TUNING.motion.settleEpsilonZoom
        const hasMotionWork = () => isDragging || isInertiaActive || hasPendingRotation() || hasPendingZoom()

        const stopMotionLoopIfIdle = () => {
          if (hasMotionWork()) return; cancelMotionFrame()
          if (isInteracting) scheduleIdleRestore()
        }

        const startMotionLoop = () => {
          if (motionFrame) return
          lastMotionTs = performance.now()
          motionFrame = requestAnimationFrame(function stepMotion(now) {
            motionFrame = 0
            const rawDt = now - lastMotionTs
            const dt = Math.max(1, Math.min(TUNING.motion.maxDtMs, Number.isFinite(rawDt) ? rawDt : 16))
            const frameRatio = dt / (1000 / 60); lastMotionTs = now
            let changed = false

            if (isInertiaActive && !isDragging) {
              rotationTarget[0] = normalizeLongitude(rotationTarget[0] + angularVelocity.lambda * dt)
              rotationTarget[1] = clamp(rotationTarget[1] + angularVelocity.phi * dt, TUNING.drag.minLatitude, TUNING.drag.maxLatitude)
              const decay = Math.pow(TUNING.inertia.decayPer60fps, frameRatio)
              angularVelocity.lambda *= decay; angularVelocity.phi *= decay
              if (Math.abs(angularVelocity.lambda) < TUNING.inertia.minVelocityDegPerMs && Math.abs(angularVelocity.phi) < TUNING.inertia.minVelocityDegPerMs) stopInertia()
            }

            const dragLerpBase = isDragging ? TUNING.motion.dragLerpActive : TUNING.motion.dragLerp
            const dragLerp = clamp(dragLerpBase * frameRatio, 0, 1)
            const lambdaDelta = shortestAngularDelta(rotationCurrent[0], rotationTarget[0])
            const phiDelta = rotationTarget[1] - rotationCurrent[1]

            if (Math.abs(lambdaDelta) > TUNING.motion.settleEpsilonDeg) { rotationCurrent[0] = normalizeLongitude(rotationCurrent[0] + lambdaDelta * dragLerp); changed = true }
            else if (rotationCurrent[0] !== rotationTarget[0]) { rotationCurrent[0] = normalizeLongitude(rotationTarget[0]); changed = true }

            if (Math.abs(phiDelta) > TUNING.motion.settleEpsilonDeg) { rotationCurrent[1] = clamp(rotationCurrent[1] + phiDelta * dragLerp, TUNING.drag.minLatitude, TUNING.drag.maxLatitude); changed = true }
            else if (rotationCurrent[1] !== rotationTarget[1]) { rotationCurrent[1] = rotationTarget[1]; changed = true }

            const zoomDelta = zoomTarget - zoomScale
            if (Math.abs(zoomDelta) > TUNING.motion.settleEpsilonZoom) {
              const zlb = isInteracting ? TUNING.motion.zoomLerpActive : TUNING.motion.zoomLerp
              const zl = clamp(zlb * frameRatio, 0, 1)
              zoomScale = clamp(zoomScale + zoomDelta * zl, TUNING.zoom.min, TUNING.zoom.max); changed = true
            } else if (zoomScale !== zoomTarget) { zoomScale = zoomTarget; changed = true }

            if (changed) {
              projection.rotate([rotationCurrent[0], rotationCurrent[1], rotationCurrent[2] || 0]); applyScale(); requestRedraw()
            }
            if (hasMotionWork()) { startMotionLoop(); return }
            stopMotionLoopIfIdle()
          })
        }

        const resize = () => {
          width = Math.max(TUNING.stage.minSizePx, Math.floor(stage.clientWidth || TUNING.stage.minSizePx))
          height = Math.max(TUNING.stage.minSizePx, Math.floor(stage.clientHeight || TUNING.stage.minSizePx))
          baseScale = Math.max(TUNING.projection.minBaseScalePx, Math.min(width, height) * TUNING.projection.baseScaleFactor + TUNING.projection.baseScaleOffset)
          svg.attr('viewBox', `0 0 ${width} ${height}`)
          svg.select('.ethno-globe-backdrop').attr('width', width).attr('height', height)
          projection.translate([width / 2, height / 2])
          applyScale(); requestRedraw()
        }

        // Drag behavior
        const dragBehavior = d3.drag<SVGSVGElement, unknown>()
          .on('start', (event: any) => {
            stage.classList.add('is-dragging'); enterInteraction(); stopInertia()
            isDragging = true; dragOrigin = [event.x, event.y]; dragRotateStart = rotationTarget.slice()
            dragDistancePx = 0; clearDragSamples(); pushDragSample(performance.now())
          })
          .on('drag', (event: any) => {
            if (!dragOrigin || !dragRotateStart) return
            const sens = TUNING.drag.sensitivity / Math.max(TUNING.zoom.min, zoomTarget || zoomScale)
            const dx = event.x - dragOrigin[0], dy = event.y - dragOrigin[1]
            const lambda = normalizeLongitude(dragRotateStart[0] + dx * sens)
            const phi = clamp(dragRotateStart[1] - dy * sens, TUNING.drag.minLatitude, TUNING.drag.maxLatitude)
            rotationTarget[0] = lambda; rotationTarget[1] = phi
            dragDistancePx = Math.max(dragDistancePx, Math.hypot(dx, dy))
            pushDragSample(performance.now())
            startMotionLoop()
          })
          .on('end', () => {
            stage.classList.remove('is-dragging'); isDragging = false
            if (dragDistancePx >= TUNING.inertia.clickSuppressDistancePx) suppressClickUntil = Date.now() + TUNING.inertia.clickSuppressMs
            if (TUNING.inertia.enabled) {
              const rv = computeReleaseVelocity()
              const minV = TUNING.inertia.minVelocityDegPerMs
              if (Math.abs(rv.lambda) >= minV || Math.abs(rv.phi) >= minV) { angularVelocity = rv; isInertiaActive = true } else stopInertia()
            } else stopInertia()
            clearDragSamples(); dragOrigin = null; dragRotateStart = null
            if (isInertiaActive) startMotionLoop(); else stopMotionLoopIfIdle()
          })

        svg.call(dragBehavior as any)

        // Wheel zoom
        const onWheel = (event: WheelEvent) => {
          event.preventDefault(); enterInteraction(); stopInertia()
          const dms = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1
          const wdp = clamp(event.deltaY * dms, -TUNING.zoom.maxWheelStepPx, TUNING.zoom.maxWheelStepPx)
          const ns = zoomTarget * Math.exp(-wdp * TUNING.zoom.wheelSensitivity)
          zoomTarget = clamp(ns, TUNING.zoom.min, TUNING.zoom.max)
          startMotionLoop()
        }
        stage.addEventListener('wheel', onWheel, { passive: false })

        // Resize
        const ro = new ResizeObserver(() => resize()); ro.observe(stage)
        const onResize = () => resize()
        window.addEventListener('resize', onResize, { passive: true })

        // Territory islands loading
        const loadTerritoryIslands = async () => {
          if (!TUNING.territoryIslands.enabled || referencedHaloNames.size === 0) return
          try {
            const geojson = await fetchFirstJson(TERRITORY_MAP_UNITS_URLS)
            if (cancelled) return
            const rawFeatures = Array.isArray(geojson?.features) ? geojson.features : []
            const usedIds = new Set<string>()
            const features = rawFeatures.map((f: any, i: number) => {
              if (!f || !f.geometry) return null
              const p = f.properties || {}
              const seed = String(f.id || p.GU_A3 || p.SU_A3 || p.BRK_A3 || p.ADM0_A3 || p.NAME || `territory-${i}`).trim() || `territory-${i}`
              let id = seed; let suffix = 1
              while (usedIds.has(id)) { id = `${seed}-${suffix}`; suffix++ }
              usedIds.add(id)
              let centroid = null
              try {
                centroid = d3.geoCentroid(f)
              } catch { /* ignore */ }
              return { ...f, id, centroid, __ethnoSupplemental: true }
            }).filter(Boolean)

            const matchedFeatures = features.filter((f: any) => {
              const names = featureNameCandidates(f).map(n => canonicalCountryName(n)).filter(n => referencedHaloNames.has(n))
              if (names.length === 0) return false
              return names.some(n => !baseWorldFeatureIndex.byName.has(n))
            })

            if (matchedFeatures.length === 0) return
            const maxR = Math.max(0, TUNING.territoryIslands.maxRenderedFeatures || 0)
            territoryIslandFeatures = maxR > 0 ? matchedFeatures.slice(0, maxR) : matchedFeatures.slice()
            bindTerritoryIslandFeatures()

            const si = buildWorldFeatureIndex(territoryIslandFeatures)
            combinedWorldFeatureIndex = mergeFeatureIndexes(baseWorldFeatureIndex, si)

            let csu = false
            countryEntries.forEach(e => {
              if (e.hasWorldShape) return
              const m = findCountryFeatureForEntry(e, territoryIslandFeatures); if (!m) return
              e.shape = m; e.hasWorldShape = true
              const fid = String(m?.id || '').trim(); if (fid) countryColorById.set(fid, e.color)
              csu = true
            })
            if (csu) countryLinks.select('path').attr('d', (d: any) => path(d.shape))
            recomputeRegionGeometries(); requestRedraw()
          } catch { /* territory data not available */ }
        }

        // Init
        bindActiveWorldData()
        applyInteractionMode()
        resize()

        // Defer territory loading
        const tTimer = setTimeout(() => loadTerritoryIslands(), TUNING.territoryIslands.deferMs)

        // Teardown
        teardownRef.current = () => {
          cancelled = true
          clearTimeout(tTimer)
          stage.removeEventListener('wheel', onWheel)
          ro.disconnect()
          window.removeEventListener('resize', onResize)
          clearIdleTimer(); cancelQueuedRedraw(); cancelMotionFrame()
          stage.innerHTML = ''
        }
      } catch (err) {
        console.error('[ethno-globe]', err)
        if (stage) stage.innerHTML = '<div class="ethno-globe-error">Could not initialize globe.</div>'
      }
    }

    init()

    return () => {
      if (teardownRef.current) teardownRef.current()
    }
  }, [handleNavigate])

  return (
    <div className="ethno-globe-layout" data-ethno-globe>
      <div ref={stageRef} className="ethno-globe-stage" role="region" aria-label="Interactive ethnomusicology globe">
        <div className="ethno-globe-loading">Loading globe...</div>
      </div>
    </div>
  )
}
