import React, { useCallback, useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature } from 'geojson';
import { Circle, CircleMarker, GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import {
  ArrowUpRight,
  BadgeAlert,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  CalendarDays,
  Filter,
  ChevronRight,
  ClipboardList,
  Copy,
  Eye,
  Flame,
  Layers3,
  MapPinned,
  Megaphone,
  MessageSquareText,
  Radar,
  ReceiptEuro,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  ThermometerSun,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/UI/EmptyState';
import { useAuth } from '../hooks/useAuth';
import {
  DPEFilters,
  DPERecord,
  DPESortOption,
  useDPEProspection,
} from '../hooks/useDPEProspection';
import {
  CadastreBbox,
  CadastreFeature,
  CadastreLayerKey,
  CadastreParcelDetails,
  useCadastreProspection,
} from '../hooks/useCadastreProspection';
import { DVFBbox, useDVFProspection } from '../hooks/useDVFProspection';
import { getSmartAlertBadge, useSmartAlerts } from '../hooks/useSmartAlerts';
import type { AlertMatchResult } from '../types/smartAlerts';
import type { Annonce } from '../types';
import {
  generateOutreach,
  type OutreachMode,
  type OutreachResult,
} from '../utils/outreachGeneration';
import { normalizeDepartmentCode } from '../utils/pigeScope';

type DPEMapPoint = DPERecord & {
  latitude: number;
  longitude: number;
};

type OpportunitySignal = {
  label: string;
  description: string;
  tone: 'red' | 'orange' | 'green' | 'slate';
};

type ScoredDPEPoint = DPEMapPoint & {
  opportunityScore: number;
  opportunitySignals: OpportunitySignal[];
};

type ProspectionTab = 'operations' | 'map' | 'list' | 'campaigns' | 'alerts';

type MapLayerKey = 'dpe' | 'dvf' | CadastreLayerKey;

const AUBE_CENTER: [number, number] = [48.2973, 4.0744];
const dpeLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const categoryOptions = ['logement', 'tertiaire', 'neuf', 'existant'];
const periodOptions = ['avant_2021', 'apres_2021'];

const sortOptions: Array<DPESortOption & { label: string }> = [
  { field: 'date_etablissement_dpe', direction: 'desc', label: 'Date récente' },
  { field: 'date_etablissement_dpe', direction: 'asc', label: 'Date ancienne' },
  { field: 'ville', direction: 'asc', label: 'Ville A-Z' },
  { field: 'ville', direction: 'desc', label: 'Ville Z-A' },
  { field: 'etiquette_dpe', direction: 'asc', label: 'DPE A-G' },
  { field: 'etiquette_dpe', direction: 'desc', label: 'DPE G-A' },
  { field: 'surface', direction: 'desc', label: 'Surface décroissante' },
  { field: 'surface', direction: 'asc', label: 'Surface croissante' },
];

const tabs: Array<{ id: ProspectionTab; label: string; icon: React.ElementType }> = [
  { id: 'operations', label: 'Vue opérationnelle', icon: Radar },
  { id: 'map', label: 'Carte', icon: MapPinned },
  { id: 'list', label: 'Liste', icon: ClipboardList },
  { id: 'campaigns', label: 'Campagnes', icon: Megaphone },
  { id: 'alerts', label: 'Alertes', icon: Bell },
];

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR').format(date);
};

const formatSurface = (value?: number | null) =>
  typeof value === 'number' ? `${Math.round(value)} m²` : '-';

const formatInteger = (value?: number | null) =>
  typeof value === 'number' ? new Intl.NumberFormat('fr-FR').format(value) : '-';

const formatCurrency = (value?: number | null) =>
  typeof value === 'number'
    ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, style: 'currency', currency: 'EUR' }).format(value)
    : '-';

const formatOptionLabel = (value: string) =>
  value
    .replace('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());

const getDateNDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const getDaysSince = (value?: string | null) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
};

const calculateOpportunity = (row: DPEMapPoint): { score: number; signals: OpportunitySignal[] } => {
  const dpe = (row.etiquette_dpe || '').toUpperCase();
  const surface = row.surface || 0;
  const heating = (row.energie_chauffage || '').toLowerCase();
  const category = (row.categorie_dpe || '').toLowerCase();
  const signals: OpportunitySignal[] = [];
  let score = 36;

  if (dpe === 'G') {
    score += 42;
    signals.push({ label: 'DPE G', description: 'Passoire énergétique prioritaire', tone: 'red' });
  } else if (dpe === 'F') {
    score += 38;
    signals.push({ label: 'DPE F', description: 'Passoire énergétique à traiter', tone: 'red' });
  } else if (dpe === 'E') {
    score += 26;
    signals.push({ label: 'DPE E', description: 'Performance énergétique fragile', tone: 'orange' });
  } else if (dpe === 'D') {
    score += 14;
  } else if (['A', 'B', 'C'].includes(dpe)) {
    score += 4;
  }

  if (getDaysSince(row.date_etablissement_dpe) <= 90) {
    score += 10;
    signals.push({ label: 'DPE récent', description: `Diagnostic réalisé le ${formatDate(row.date_etablissement_dpe)}`, tone: 'green' });
  }

  if (surface >= 120) {
    score += 8;
    signals.push({ label: 'Grande surface', description: `${formatSurface(row.surface)} à analyser`, tone: 'orange' });
  }

  if (heating.includes('élect') || heating.includes('elect')) {
    score += 7;
    signals.push({ label: 'Chauffage électrique', description: 'Énergie chauffage déclarée', tone: 'orange' });
  }

  if (category.includes('tertiaire')) {
    score += 7;
    signals.push({ label: 'Tertiaire', description: 'Catégorie DPE tertiaire', tone: 'slate' });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    signals,
  };
};

const getScoreColor = (score: number) => {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#fb923c';
  return '#ef4444';
};

const getEnergyBadgeClass = (label?: string | null) => {
  switch ((label || '').toUpperCase()) {
    case 'A':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'B':
      return 'bg-lime-100 text-lime-800 border-lime-200';
    case 'C':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'D':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'E':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'F':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'G':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const getSignalClasses = (tone: OpportunitySignal['tone']) => {
  if (tone === 'red') return 'bg-red-50 text-red-700 border-red-100';
  if (tone === 'orange') return 'bg-orange-50 text-orange-700 border-orange-100';
  if (tone === 'green') return 'bg-green-50 text-green-700 border-green-100';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const getScoreBand = (score: number) => {
  if (score >= 80) return '75 - 100';
  if (score >= 60) return '50 - 75';
  if (score >= 40) return '25 - 50';
  return '0 - 25';
};

const extractGeometryBounds = (geometry?: Record<string, unknown>) => {
  const coordinates = geometry?.coordinates;
  const values: Array<[number, number]> = [];

  const visit = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      values.push([node[0], node[1]]);
      return;
    }
    node.forEach(visit);
  };

  visit(coordinates);
  if (values.length === 0) return null;

  return values.reduce(
    (bounds, [lng, lat]) => ({
      minLng: Math.min(bounds.minLng, lng),
      minLat: Math.min(bounds.minLat, lat),
      maxLng: Math.max(bounds.maxLng, lng),
      maxLat: Math.max(bounds.maxLat, lat),
    }),
    { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity }
  );
};

const boundsIntersect = (
  a: ReturnType<typeof extractGeometryBounds>,
  b: ReturnType<typeof extractGeometryBounds>
) => Boolean(
  a && b &&
  a.minLng <= b.maxLng &&
  a.maxLng >= b.minLng &&
  a.minLat <= b.maxLat &&
  a.maxLat >= b.minLat
);

const pointInBounds = (
  point: ScoredDPEPoint,
  bounds: ReturnType<typeof extractGeometryBounds>
) => Boolean(
  bounds &&
  point.longitude >= bounds.minLng &&
  point.longitude <= bounds.maxLng &&
  point.latitude >= bounds.minLat &&
  point.latitude <= bounds.maxLat
);

const calculateCadastreOpportunity = (
  parcel: CadastreFeature,
  buildings: CadastreFeature[],
  dpePoints: ScoredDPEPoint[]
) => {
  const parcelBounds = extractGeometryBounds(parcel.bbox || parcel.geometry);
  const nearbyBuildings = buildings.filter((building) =>
    boundsIntersect(parcelBounds, extractGeometryBounds(building.bbox || building.geometry))
  );
  const nearbyPassoires = dpePoints.filter((point) =>
    ['F', 'G'].includes((point.etiquette_dpe || '').toUpperCase()) &&
    pointInBounds(point, parcelBounds)
  );
  const signals: OpportunitySignal[] = [];
  let score = 34;

  if ((parcel.area_cadastre || 0) >= 1500) {
    score += 18;
    signals.push({ label: 'Grande parcelle', description: `${formatInteger(parcel.area_cadastre)} m² cadastraux`, tone: 'orange' });
  } else if ((parcel.area_cadastre || 0) >= 700) {
    score += 10;
    signals.push({ label: 'Surface exploitable', description: `${formatInteger(parcel.area_cadastre)} m² cadastraux`, tone: 'slate' });
  }

  if (nearbyBuildings.length > 0) {
    score += 14;
    signals.push({ label: 'Bâti présent', description: `${nearbyBuildings.length} bâtiment(s) dans l'emprise`, tone: 'green' });
  }

  if (nearbyBuildings.length >= 2) {
    score += 10;
    signals.push({ label: 'Multi-bâtiments', description: 'Plusieurs bâtiments détectés sur l’emprise visible', tone: 'orange' });
  }

  if (nearbyPassoires.length > 0) {
    score += 24;
    signals.push({ label: 'DPE F/G proche', description: 'Passoire énergétique dans l’emprise visible', tone: 'red' });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    signals,
  };
};

const buildAnnonceFromDpe = (point: ScoredDPEPoint): Annonce => ({
  id: `dpe-${point.id}`,
  title: `${point.type_batiment || point.categorie_dpe || 'Bien'} ${point.ville ? `à ${point.ville}` : ''}`.trim(),
  description: [
    point.adresse,
    point.code_postal || point.ville ? [point.code_postal, point.ville].filter(Boolean).join(' ') : null,
    point.etiquette_dpe ? `Classe DPE ${point.etiquette_dpe}` : null,
    point.etiquette_ges ? `GES ${point.etiquette_ges}` : null,
    point.energie_chauffage ? `Chauffage ${point.energie_chauffage}` : null,
  ].filter(Boolean).join(' • '),
  price: 0,
  size: point.surface || 0,
  rooms: 0,
  bedrooms: 0,
  type_de_bien: point.type_batiment || point.categorie_dpe || 'Bien',
  city: point.ville || '',
  postal_code: point.code_postal || '',
  adresse: point.adresse || '',
  lat: point.latitude,
  lng: point.longitude,
  image_urls: null,
  image_url: null,
  phone: '',
  urgence: false,
  urgence_detectee: false,
  source: 'dpe',
  url: '',
  owner_type: '',
  departement: point.departement || '',
  dpe: point.etiquette_dpe || undefined,
  ges: point.etiquette_ges || undefined,
  publication_date: point.date_etablissement_dpe || new Date().toISOString(),
  supprimee: false,
  en_ligne: true,
  maj_prix: false,
  booster: false,
  created_at: point.created_at || new Date().toISOString(),
});

const createScoreIcon = (score: number) => {
  const color = getScoreColor(score);

  return L.divIcon({
    className: 'prospection-score-marker',
    html: `
      <div style="
        align-items:center;
        background:white;
        border:3px solid ${color};
        border-radius:9999px;
        box-shadow:0 14px 34px rgba(15,23,42,0.26);
        color:#0f172a;
        display:flex;
        font-size:15px;
        font-weight:900;
        height:46px;
        justify-content:center;
        width:46px;
      ">${score}</div>
    `,
    iconAnchor: [23, 23],
    popupAnchor: [0, -24],
  });
};

const MapAutoFit: React.FC<{ points: ScoredDPEPoint[] }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      map.setView(AUBE_CENTER, 12);
      return;
    }

    const bounds = L.latLngBounds(points.map((point) => [point.latitude, point.longitude]));
    map.fitBounds(bounds, {
      maxZoom: 15,
      padding: [52, 52],
    });
  }, [map, points]);

  return null;
};

const MapZoomControls: React.FC = () => {
  const map = useMap();

  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control mt-4 overflow-hidden rounded-2xl bg-white shadow-lg">
        <button
          type="button"
          onClick={() => map.zoomIn()}
          className="block h-11 w-11 border-b border-gray-100 text-2xl font-light text-secondary-800 hover:bg-secondary-50"
          aria-label="Zoomer"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => map.zoomOut()}
          className="block h-11 w-11 text-2xl font-light text-secondary-800 hover:bg-secondary-50"
          aria-label="Dézoomer"
        >
          -
        </button>
      </div>
    </div>
  );
};

const toLeafletFeature = (feature: CadastreFeature): Feature => ({
  type: 'Feature' as const,
  properties: feature,
  geometry: feature.geometry as Feature['geometry'],
});

const getCadastreStyle = (layer: CadastreLayerKey) => {
  if (layer === 'communes') {
    return { color: '#2563eb', weight: 2, fillOpacity: 0.03 };
  }

  if (layer === 'sections') {
    return { color: '#7c3aed', weight: 1.5, fillOpacity: 0.04 };
  }

  if (layer === 'buildings') {
    return { color: '#0f172a', weight: 1, fillColor: '#0f172a', fillOpacity: 0.28 };
  }

  return { color: '#f97316', weight: 1.2, fillColor: '#fb923c', fillOpacity: 0.08 };
};

const CadastreMapWatcher: React.FC<{
  enabledLayers: CadastreLayerKey[];
  onBoundsChange: (bbox: CadastreBbox) => void;
}> = ({ enabledLayers, onBoundsChange }) => {
  const map = useMapEvents({
    moveend: () => {
      if (enabledLayers.length === 0) return;
      const bounds = map.getBounds();
      onBoundsChange({
        minLng: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLng: bounds.getEast(),
        maxLat: bounds.getNorth(),
        zoom: map.getZoom(),
      });
    },
    zoomend: () => {
      if (enabledLayers.length === 0) return;
      const bounds = map.getBounds();
      onBoundsChange({
        minLng: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLng: bounds.getEast(),
        maxLat: bounds.getNorth(),
        zoom: map.getZoom(),
      });
    },
  });

  useEffect(() => {
    if (enabledLayers.length === 0) return;
    const bounds = map.getBounds();
    onBoundsChange({
      minLng: bounds.getWest(),
      minLat: bounds.getSouth(),
      maxLng: bounds.getEast(),
      maxLat: bounds.getNorth(),
      zoom: map.getZoom(),
    });
  }, [enabledLayers, map, onBoundsChange]);

  return null;
};

const DVFMapWatcher: React.FC<{
  enabled: boolean;
  onBoundsChange: (bbox: DVFBbox) => void;
}> = ({ enabled, onBoundsChange }) => {
  const map = useMapEvents({
    moveend: () => {
      if (!enabled) return;
      const bounds = map.getBounds();
      onBoundsChange({
        minLng: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLng: bounds.getEast(),
        maxLat: bounds.getNorth(),
      });
    },
    zoomend: () => {
      if (!enabled) return;
      const bounds = map.getBounds();
      onBoundsChange({
        minLng: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLng: bounds.getEast(),
        maxLat: bounds.getNorth(),
      });
    },
  });

  useEffect(() => {
    if (!enabled) return;
    const bounds = map.getBounds();
    onBoundsChange({
      minLng: bounds.getWest(),
      minLat: bounds.getSouth(),
      maxLng: bounds.getEast(),
      maxLat: bounds.getNorth(),
    });
  }, [enabled, map, onBoundsChange]);

  return null;
};

const InfoCell: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-2xl border border-gray-100 bg-white px-3 py-3 text-center">
    <p className="text-xs font-semibold text-secondary-400">{label}</p>
    <p className="mt-1 text-sm font-bold text-secondary-900">{value || '-'}</p>
  </div>
);

const getEmptyMapDescription = (
  reason: ReturnType<typeof useDPEProspection>['diagnostic']['zeroResultReason']
) => {
  if (reason === 'no_coordinates') {
    return 'Des DPE sont visibles avec vos accès, mais aucun ne possède encore de latitude et longitude pour être affiché sur la carte.';
  }

  if (reason === 'no_visible_rows') {
    return 'Supabase ne renvoie aucun DPE pour vos départements et filtres actuels. Vérifiez la RLS, le format du département et les données de la table public.dpe.';
  }

  if (reason === 'department_out_of_scope') {
    return "Le département filtré n'est pas inclus dans vos accès GetFlaire.";
  }

  return 'Le fond de carte reste disponible, mais aucun diagnostic avec coordonnées ne correspond à cette recherche.';
};

const MapLoadingState: React.FC = () => (
  <section className="prospection-map-shell">
    <div className="flex h-[28rem] min-h-[420px] items-center justify-center bg-[linear-gradient(180deg,#f8fafc,#eef2ff)] md:h-[34rem] lg:h-[calc(100vh-12.5rem)] lg:min-h-[560px]">
      <div className="text-center">
        <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-primary-100 border-t-primary-500" />
        <p className="mt-4 text-sm font-bold text-secondary-600">Chargement de la carte...</p>
      </div>
    </div>
  </section>
);

const DetailPanelContent: React.FC<{ selectedDpe: ScoredDPEPoint; onClose: () => void }> = ({
  selectedDpe,
  onClose,
}) => (
  <>
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-black text-secondary-950">Détail du bien</h2>
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl p-2 text-secondary-400 hover:bg-secondary-50 hover:text-secondary-700"
      >
        ×
      </button>
    </div>

    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[24px] border border-secondary-900/5 bg-[linear-gradient(160deg,#0f172a,#1e293b)] p-5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,178,63,0.32),transparent_13rem),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.1),transparent_12rem)]" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-200">Diagnostic énergétique</p>
              <p className="mt-2 text-sm text-white/70">
                {selectedDpe.categorie_dpe || 'DPE'}
                {selectedDpe.periode_dpe ? ` · ${formatOptionLabel(selectedDpe.periode_dpe)}` : ''}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 text-right backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">Score</p>
              <p className="text-2xl font-black text-primary-300">
                {selectedDpe.opportunityScore}<span className="text-sm text-white/60">/100</span>
              </p>
            </div>
          </div>
          <div className="mt-7 flex items-end justify-between">
            <div>
              <p className="text-5xl font-black">{selectedDpe.etiquette_dpe || '-'}</p>
              <p className="mt-1 text-sm text-white/70">Classe DPE</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black">{selectedDpe.etiquette_ges || '-'}</p>
              <p className="mt-1 text-sm text-white/70">GES</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-green-100 bg-green-50 p-3">
        <div>
          <p className="text-xs font-bold text-green-700">Score d'opportunité</p>
          <p className="mt-1 text-sm text-green-800">Priorité visuelle {getScoreBand(selectedDpe.opportunityScore)}</p>
        </div>
        <p className="text-3xl font-black text-green-700">
          {selectedDpe.opportunityScore}<span className="text-base">/100</span>
        </p>
      </div>

      <div>
        <h3 className="text-lg font-black text-secondary-950">
          {selectedDpe.adresse || 'Adresse non renseignée'}
        </h3>
        <p className="mt-1 text-sm font-medium text-secondary-500">
          {[selectedDpe.code_postal, selectedDpe.ville].filter(Boolean).join(' ') || '-'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <InfoCell label="Type" value={selectedDpe.type_batiment || selectedDpe.categorie_dpe || '-'} />
        <InfoCell label="Surface" value={formatSurface(selectedDpe.surface)} />
        <InfoCell label="Date DPE" value={formatDate(selectedDpe.date_etablissement_dpe)} />
        <InfoCell label="Période" value={selectedDpe.periode_dpe || '-'} />
        <InfoCell label="Catégorie" value={selectedDpe.categorie_dpe || '-'} />
        <InfoCell label="Chauffage" value={selectedDpe.energie_chauffage || '-'} />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-sm font-black text-secondary-950">Signaux détectés</h4>
        {selectedDpe.opportunitySignals.length > 0 ? (
          <div className="mt-3 space-y-2">
            {selectedDpe.opportunitySignals.map((signal) => (
              <div key={signal.label} className={`rounded-2xl border px-3 py-3 ${getSignalClasses(signal.tone)}`}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 ring-1 ring-black/5">
                    {signal.label.includes('DPE') ? (
                      <Flame className="h-4 w-4" />
                    ) : signal.label.includes('Chauffage') ? (
                      <ThermometerSun className="h-4 w-4" />
                    ) : signal.label.includes('Tertiaire') ? (
                      <Layers3 className="h-4 w-4" />
                    ) : (
                      <CalendarDays className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <p className="font-black">{signal.label}</p>
                    <p className="mt-1 text-sm opacity-80">{signal.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm text-secondary-500">
            Aucun signal fort déduit des champs DPE disponibles.
          </p>
        )}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-sm font-black text-secondary-950">Informations DPE</h4>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-secondary-400">Catégorie</dt>
            <dd className="font-bold text-secondary-900">{selectedDpe.categorie_dpe || '-'}</dd>
          </div>
          <div>
            <dt className="text-secondary-400">Chauffage</dt>
            <dd className="font-bold text-secondary-900">{selectedDpe.energie_chauffage || '-'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-secondary-400">Source</dt>
            <dd className="break-words font-bold text-secondary-900">{selectedDpe.source_fichier || '-'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-secondary-400">Numéro DPE</dt>
            <dd className="break-words font-bold text-secondary-900">{selectedDpe.numero_dpe || '-'}</dd>
          </div>
        </dl>
      </div>

      <button
        type="button"
        disabled
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white text-sm font-black text-secondary-400"
      >
        <Target className="h-4 w-4" />
        Préparer une action
      </button>
    </div>
  </>
);

const FiltersPanelContent: React.FC<{
  filters: DPEFilters;
  scopedDepartments: string[];
  quickFilters: Array<{
    label: string;
    icon: React.ElementType;
    count: number;
    active: boolean;
    onClick: () => void;
  }>;
  loading: boolean;
  mapPointsCount: number;
  totalCount: number | null;
  updateFilter: <K extends keyof DPEFilters>(key: K, value: DPEFilters[K] | undefined) => void;
  toggleLabelFilter: (key: 'etiquette_dpe' | 'etiquette_ges', label: string) => void;
  resetFilters: () => void;
  refresh: () => void;
}> = ({
  filters,
  scopedDepartments,
  quickFilters,
  loading,
  mapPointsCount,
  totalCount,
  updateFilter,
  toggleLabelFilter,
  resetFilters,
  refresh,
}) => (
  <>
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
      <h2 className="text-xl font-black text-secondary-950">Filtres</h2>
      <button
        type="button"
        onClick={resetFilters}
        className="text-sm font-bold text-primary-600 hover:text-primary-700"
      >
        Réinitialiser
      </button>
    </div>

    <div className="space-y-5 py-5">
      <div className="prospection-filter-section">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-800">Localisation</p>
        <label className="mb-3 block">
          <span className="mb-2 block text-sm font-medium text-secondary-500">Département</span>
          <select
            value={normalizeDepartmentCode(filters.departement) || ''}
            onChange={(event) => updateFilter('departement', event.target.value || undefined)}
            className="h-12 w-full rounded-xl border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
          >
            <option value="">Tous autorisés</option>
            {scopedDepartments.map((department) => (
              <option key={department} value={department}>
                {department === '10' ? 'Aube (10)' : department}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-3 block">
          <span className="mb-2 block text-sm font-medium text-secondary-500">Commune</span>
          <input
            type="text"
            value={filters.ville || ''}
            onChange={(event) => updateFilter('ville', event.target.value || undefined)}
            placeholder="Troyes"
            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-secondary-500">Code postal</span>
          <input
            type="text"
            value={filters.code_postal || ''}
            onChange={(event) => updateFilter('code_postal', event.target.value || undefined)}
            placeholder="10000"
            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
          />
        </label>
      </div>

      <div className="prospection-filter-section border-t border-gray-100 pt-5">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-800">Signaux</p>
        <div className="space-y-2">
          {quickFilters.map(({ label, icon: Icon, active, count, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition ${
                active
                  ? 'border-primary-200 bg-primary-50 text-primary-900'
                  : 'border-gray-100 bg-white text-secondary-700 hover:border-primary-100 hover:bg-primary-50/50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-md ${active ? 'bg-primary-500 text-white' : 'bg-primary-100 text-primary-700'}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {label}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-secondary-500 ring-1 ring-gray-200">
                  {count}
                </span>
                {active && <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700">actif</span>}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="prospection-filter-section border-t border-gray-100 pt-5">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-800">Étiquettes DPE</p>
        <div className="flex flex-wrap gap-2">
          {dpeLabels.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleLabelFilter('etiquette_dpe', label)}
              className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-black transition ${
                filters.etiquette_dpe?.includes(label)
                  ? getEnergyBadgeClass(label)
                  : 'border-gray-200 bg-white text-secondary-600 hover:bg-primary-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="prospection-filter-section border-t border-gray-100 pt-5">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-800">Étiquettes GES</p>
        <div className="flex flex-wrap gap-2">
          {dpeLabels.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleLabelFilter('etiquette_ges', label)}
              className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-black transition ${
                filters.etiquette_ges?.includes(label)
                  ? getEnergyBadgeClass(label)
                  : 'border-gray-200 bg-white text-secondary-600 hover:bg-primary-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="prospection-filter-section border-t border-gray-100 pt-5">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-800">Filtres DPE</p>
        <div className="space-y-3">
          <select
            value={filters.categorie_dpe || ''}
            onChange={(event) => updateFilter('categorie_dpe', event.target.value || undefined)}
            className="h-12 w-full rounded-xl border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
          >
            <option value="">Toutes catégories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>{formatOptionLabel(category)}</option>
            ))}
          </select>
          <select
            value={filters.periode_dpe || ''}
            onChange={(event) => updateFilter('periode_dpe', event.target.value || undefined)}
            className="h-12 w-full rounded-xl border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
          >
            <option value="">Toutes périodes</option>
            {periodOptions.map((period) => (
              <option key={period} value={period}>{formatOptionLabel(period)}</option>
            ))}
          </select>
          <input
            type="text"
            value={filters.energie_chauffage || ''}
            onChange={(event) => updateFilter('energie_chauffage', event.target.value || undefined)}
            placeholder="Énergie chauffage"
            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="prospection-filter-section border-t border-gray-100 pt-5">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-800">Période et surface</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={filters.date_min || ''}
            onChange={(event) => updateFilter('date_min', event.target.value || undefined)}
            className="h-11 rounded-xl border border-gray-200 bg-white px-2 text-xs shadow-sm focus:border-primary-400 focus:ring-primary-500"
          />
          <input
            type="date"
            value={filters.date_max || ''}
            onChange={(event) => updateFilter('date_max', event.target.value || undefined)}
            className="h-11 rounded-xl border border-gray-200 bg-white px-2 text-xs shadow-sm focus:border-primary-400 focus:ring-primary-500"
          />
          <input
            type="number"
            min="0"
            value={filters.surface_min ?? ''}
            onChange={(event) => updateFilter('surface_min', event.target.value ? Number(event.target.value) : undefined)}
            placeholder="Min."
            className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
          />
          <input
            type="number"
            min="0"
            value={filters.surface_max ?? ''}
            onChange={(event) => updateFilter('surface_max', event.target.value ? Number(event.target.value) : undefined)}
            placeholder="Max."
            className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-secondary-950">Résultats chargés</p>
            <p className="mt-1 text-xs leading-5 text-secondary-500">
              Carte DPE active sur vos départements autorisés.
            </p>
          </div>
          <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm ring-1 ring-primary-100">
            <p className="text-lg font-black text-primary-700">{mapPointsCount}</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary-400">
              points
            </p>
          </div>
        </div>
      </div>
    </div>

    <button
      type="button"
      onClick={refresh}
      disabled={loading}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 text-sm font-black text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-600 disabled:opacity-60"
    >
      <RefreshCcw className="h-4 w-4" />
      Appliquer les filtres
    </button>

    <p className="mt-4 text-center text-sm font-bold text-primary-600">
      {mapPointsCount} point{mapPointsCount > 1 ? 's' : ''} chargé{mapPointsCount > 1 ? 's' : ''}
      {totalCount ? ` / ${totalCount}` : ''}
    </p>
  </>
);

const SummaryCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint: string;
}> = ({ icon: Icon, label, value, hint }) => (
  <div className="rounded-3xl border border-white/70 bg-white/95 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-secondary-500">{label}</p>
        <p className="mt-2 text-3xl font-black text-secondary-950">{value}</p>
      </div>
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
        <Icon className="h-5 w-5" />
      </span>
    </div>
    <p className="mt-3 text-sm text-secondary-500">{hint}</p>
  </div>
);

const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, action, children }) => (
  <section className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] lg:p-6">
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-black text-secondary-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-secondary-500">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const ProspectionPage: React.FC = () => {
  const { appUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ProspectionTab>('map');
  const [filters, setFilters] = useState<DPEFilters>({});
  const [sort, setSort] = useState<DPESortOption>({
    field: 'date_etablissement_dpe',
    direction: 'desc',
  });
  const [selectedDpe, setSelectedDpe] = useState<ScoredDPEPoint | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [visibleLayers, setVisibleLayers] = useState<Record<MapLayerKey, boolean>>({
    dpe: true,
    dvf: true,
    communes: true,
    sections: false,
    parcels: true,
    buildings: true,
  });
  const [parcelSearch, setParcelSearch] = useState('');
  const [parcelSearchResults, setParcelSearchResults] = useState<CadastreFeature[]>([]);
  const [parcelSearchError, setParcelSearchError] = useState<string | null>(null);
  const [selectedParcelDetails, setSelectedParcelDetails] = useState<CadastreParcelDetails | null>(null);
  const [campaignMode, setCampaignMode] = useState<OutreachMode>('both');
  const [campaignResult, setCampaignResult] = useState<OutreachResult | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  const authorizedDepartments = appUser?.departements_autorises || [];
  const {
    dpeRows,
    loading,
    error,
    hasMore,
    totalCount,
    scopedDepartments,
    selectedDepartmentOutOfScope,
    diagnostic,
    refresh,
    loadMore,
  } = useDPEProspection({
    filters,
    sort,
    authorizedDepartments,
    limit: 100,
    mapOnly: true,
  });
  const {
    alerts,
    notifications,
    results: alertResults,
    loading: alertsLoading,
    error: alertsError,
  } = useSmartAlerts();
  const {
    features: cadastreFeatures,
    loading: cadastreLoading,
    error: cadastreError,
    hasAnyCadastreFeature,
    loadCadastre,
    searchParcel,
    getParcelDetails,
  } = useCadastreProspection();
  const {
    mutations: dvfMutations,
    loading: dvfLoading,
    error: dvfError,
    loadDVF,
  } = useDVFProspection({ authorizedDepartments });

  const activeCadastreLayers = useMemo(
    () =>
      (['communes', 'sections', 'parcels', 'buildings'] as CadastreLayerKey[])
        .filter((layer) => visibleLayers[layer]),
    [visibleLayers]
  );

  const handleCadastreBoundsChange = useCallback(
    (bbox: CadastreBbox) => {
      void loadCadastre(bbox, activeCadastreLayers);
    },
    [activeCadastreLayers, loadCadastre]
  );

  const handleDVFBoundsChange = useCallback(
    (bbox: DVFBbox) => {
      void loadDVF(bbox);
    },
    [loadDVF]
  );

  const handleParcelSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setParcelSearchError(null);
    setSelectedParcelDetails(null);

    try {
      const results = await searchParcel(parcelSearch);
      setParcelSearchResults(results);
      if (results.length === 0) {
        setParcelSearchError('Aucune parcelle trouvée pour cette référence. Le cadastre est peut-être encore vide sur cette base.');
        return;
      }
      if (results[0]?.parcel_code) {
        const details = await getParcelDetails(results[0].parcel_code);
        setSelectedParcelDetails(details);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Recherche parcelle impossible';
      setParcelSearchError(message);
      setParcelSearchResults([]);
    }
  };

  const mapPoints = useMemo(
    () =>
      dpeRows
        .filter(
          (row): row is DPEMapPoint =>
            typeof row.latitude === 'number' && typeof row.longitude === 'number'
        )
        .map((row): ScoredDPEPoint => {
          const opportunity = calculateOpportunity(row);
          return {
            ...row,
            opportunityScore: opportunity.score,
            opportunitySignals: opportunity.signals,
          };
        }),
    [dpeRows]
  );

  useEffect(() => {
    setSelectedDpe((current) => {
      if (!current) return null;
      return mapPoints.some((point) => point.id === current.id) ? current : null;
    });
  }, [mapPoints]);

  useEffect(() => {
    if (!selectedDpe) {
      setDetailPanelOpen(false);
    }
  }, [selectedDpe]);

  useEffect(() => {
    setCampaignResult(null);
    setCampaignError(null);
  }, [selectedDpe?.id, campaignMode]);

  const activeFiltersCount = useMemo(
    () =>
      Object.values(filters).filter((value) =>
        value !== undefined &&
        value !== '' &&
        (Array.isArray(value) ? value.length > 0 : true)
      ).length,
    [filters]
  );

  const signalCounts = useMemo(
    () => ({
      fg: mapPoints.filter((point) => ['F', 'G'].includes((point.etiquette_dpe || '').toUpperCase())).length,
      recent: mapPoints.filter((point) => getDaysSince(point.date_etablissement_dpe) <= 90).length,
      electric: mapPoints.filter((point) =>
        (point.energie_chauffage || '').toLowerCase().includes('elect') ||
        (point.energie_chauffage || '').toLowerCase().includes('élect')
      ).length,
      tertiary: mapPoints.filter((point) => (point.categorie_dpe || '').toLowerCase().includes('tertiaire')).length,
    }),
    [mapPoints]
  );

  const topCommunes = useMemo(() => {
    const counts = new Map<string, number>();
    mapPoints.forEach((point) => {
      const key = point.ville || 'Ville inconnue';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [mapPoints]);

  const scoreDistribution = useMemo(() => {
    const buckets = [
      { label: '0-39', min: 0, max: 39, color: 'bg-red-500' },
      { label: '40-59', min: 40, max: 59, color: 'bg-orange-400' },
      { label: '60-79', min: 60, max: 79, color: 'bg-amber-500' },
      { label: '80-100', min: 80, max: 100, color: 'bg-green-500' },
    ];

    return buckets.map((bucket) => ({
      ...bucket,
      count: mapPoints.filter(
        (point) => point.opportunityScore >= bucket.min && point.opportunityScore <= bucket.max
      ).length,
    }));
  }, [mapPoints]);

  const topOpportunities = useMemo(
    () => [...mapPoints].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 8),
    [mapPoints]
  );

  const scoredCadastreParcels = useMemo(
    () =>
      cadastreFeatures.parcels.map((parcel) => ({
        ...parcel,
        cadastreOpportunity: calculateCadastreOpportunity(parcel, cadastreFeatures.buildings, mapPoints),
      })),
    [cadastreFeatures.buildings, cadastreFeatures.parcels, mapPoints]
  );

  const cadastreStrongOpportunities = useMemo(
    () => scoredCadastreParcels.filter((parcel) => parcel.cadastreOpportunity.score >= 70).length,
    [scoredCadastreParcels]
  );

  const averageScore = useMemo(() => {
    if (mapPoints.length === 0) return 0;
    return Math.round(
      mapPoints.reduce((sum, point) => sum + point.opportunityScore, 0) / mapPoints.length
    );
  }, [mapPoints]);

  const geocodedRatio = totalCount ? Math.round((mapPoints.length / totalCount) * 100) : 0;

  const selectedAnnonce = useMemo(
    () => (selectedDpe ? buildAnnonceFromDpe(selectedDpe) : null),
    [selectedDpe]
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read_at),
    [notifications]
  );

  const activeAlerts = useMemo(
    () => alerts.filter((alert) => alert.statut === 'active'),
    [alerts]
  );

  const handleSelectPoint = (point: ScoredDPEPoint) => {
    setSelectedDpe(point);
    setDetailPanelOpen(true);
  };

  const handleGenerateCampaign = async () => {
    if (!selectedAnnonce) return;

    setCampaignLoading(true);
    setCampaignError(null);

    try {
      const result = await generateOutreach({
        annonce: selectedAnnonce,
        mode: campaignMode,
        commercialProfile: appUser?.personalization_settings?.commercial_profile,
        userProfile: {
          firstName: appUser?.Prenom,
          lastName: appUser?.nom,
          phone: appUser?.telephone,
          email: appUser?.email,
          agencyName: appUser?.agency?.name,
        },
      });
      setCampaignResult(result);
    } catch (err) {
      setCampaignError(err instanceof Error ? err.message : 'Impossible de générer la campagne.');
    } finally {
      setCampaignLoading(false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error('clipboard copy failed', err);
    }
  };

  const updateFilter = <K extends keyof DPEFilters>(key: K, value: DPEFilters[K] | undefined) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value === '' ? undefined : value,
    }));
  };

  const toggleLabelFilter = (key: 'etiquette_dpe' | 'etiquette_ges', label: string) => {
    setFilters((previous) => {
      const current = previous[key] || [];
      const next = current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label];

      return {
        ...previous,
        [key]: next.length ? next : undefined,
      };
    });
  };

  const resetFilters = () => setFilters({});

  const quickFilters = [
    {
      label: 'Passoires F/G',
      icon: Flame,
      count: signalCounts.fg,
      active: filters.etiquette_dpe?.includes('F') && filters.etiquette_dpe?.includes('G'),
      onClick: () => updateFilter('etiquette_dpe', ['F', 'G']),
    },
    {
      label: 'DPE récents',
      icon: CalendarClock,
      count: signalCounts.recent,
      active: filters.date_min === getDateNDaysAgo(90),
      onClick: () => updateFilter('date_min', getDateNDaysAgo(90)),
    },
    {
      label: 'Chauffage électrique',
      icon: Zap,
      count: signalCounts.electric,
      active: filters.energie_chauffage === 'Électricité',
      onClick: () => updateFilter('energie_chauffage', 'Électricité'),
    },
    {
      label: 'Tertiaire',
      icon: Building2,
      count: signalCounts.tertiary,
      active: filters.categorie_dpe === 'tertiaire',
      onClick: () => updateFilter('categorie_dpe', 'tertiaire'),
    },
  ];

  const hasNoAuthorizedDepartments = Boolean(appUser) && scopedDepartments.length === 0;
  const selectedSortValue = `${sort.field}-${sort.direction}`;
  const emptyMapDescription = getEmptyMapDescription(diagnostic.zeroResultReason);

  return (
    <div className="-m-4 min-h-[calc(100vh-5.5rem)] bg-slate-100 lg:-m-6">
      <div className="border-b border-gray-200/80 bg-white/92 px-4 py-2.5 shadow-[0_6px_24px_rgba(15,23,42,0.04)] backdrop-blur lg:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-black text-secondary-950 lg:text-xl">Prospection</h1>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700 ring-1 ring-primary-100">
                <Zap className="h-3.5 w-3.5" />
                Nouvelle interface
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-4">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`inline-flex items-center gap-2 border-b-2 px-1 py-1.5 text-sm font-semibold transition ${
                    activeTab === id
                      ? 'border-primary-500 text-secondary-950'
                      : 'border-transparent text-secondary-500 hover:text-secondary-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end">
            <label className="relative block w-full xl:w-[23rem] 2xl:w-[26rem]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
              <input
                type="text"
                value={filters.search || ''}
                onChange={(event) => updateFilter('search', event.target.value || undefined)}
                placeholder="Rechercher une adresse, une ville..."
                className="h-11 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="prospection-map-stage">
        <main className="prospection-map-panel space-y-0">
          <div className="px-4 py-3 lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-white/80 bg-white/92 p-2 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersPanelOpen(true)}
                  className="prospection-floating-control"
                >
                  <Filter className="h-4 w-4 text-secondary-500" />
                  <span className="text-sm font-semibold text-secondary-900">Filtres</span>
                  {activeFiltersCount > 0 && (
                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                <div className="prospection-floating-control">
                  <SlidersHorizontal className="h-4 w-4 text-secondary-500" />
                  <select
                    value={selectedSortValue}
                    onChange={(event) => {
                      const [field, direction] = event.target.value.split('-');
                      setSort({
                        field: field as DPESortOption['field'],
                        direction: direction as DPESortOption['direction'],
                      });
                    }}
                    className="h-11 bg-transparent pr-8 text-sm font-semibold text-secondary-900 focus:border-transparent focus:ring-0"
                  >
                    {sortOptions.map((option) => (
                      <option key={`${option.field}-${option.direction}`} value={`${option.field}-${option.direction}`}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {activeTab === 'map' && (
                  <div className="prospection-floating-control flex-wrap">
                    <Layers3 className="h-4 w-4 text-secondary-500" />
                    {([
                      ['dpe', 'DPE'],
                      ['dvf', 'DVF'],
                      ['communes', 'Communes'],
                      ['sections', 'Sections'],
                      ['parcels', 'Parcelles'],
                      ['buildings', 'Bâtiments'],
                    ] as Array<[MapLayerKey, string]>).map(([layer, label]) => (
                      <button
                        key={layer}
                        type="button"
                        onClick={() => setVisibleLayers((previous) => ({ ...previous, [layer]: !previous[layer] }))}
                        className={`rounded-full px-3 py-1 text-xs font-black transition ${
                          visibleLayers[layer]
                            ? 'bg-secondary-900 text-white'
                            : 'bg-secondary-100 text-secondary-500 hover:bg-secondary-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowZones((previous) => !previous)}
                      className={`rounded-full px-3 py-1 text-xs font-black transition ${
                        showZones ? 'bg-primary-500 text-white' : 'bg-primary-50 text-primary-700'
                      }`}
                    >
                      Zones
                    </button>
                  </div>
                )}

                {activeTab === 'map' && (
                  <form onSubmit={handleParcelSearch} className="prospection-floating-control">
                    <Search className="h-4 w-4 text-secondary-500" />
                    <input
                      value={parcelSearch}
                      onChange={(event) => setParcelSearch(event.target.value)}
                      placeholder="Réf. parcelle"
                      className="h-10 w-36 border-0 bg-transparent px-0 text-sm font-semibold focus:ring-0"
                    />
                    <button
                      type="submit"
                      className="rounded-full bg-secondary-900 px-3 py-1.5 text-xs font-black text-white"
                    >
                      Rechercher
                    </button>
                  </form>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-bold text-primary-700 ring-1 ring-primary-100">
                  {formatInteger(mapPoints.length)} point{mapPoints.length > 1 ? 's' : ''} géocodé{mapPoints.length > 1 ? 's' : ''}
                </span>
                {totalCount ? (
                  <span className="rounded-full bg-secondary-100 px-3 py-1 font-semibold text-secondary-700">
                    {formatInteger(totalCount)} DPE visibles
                  </span>
                ) : null}
                {activeTab === 'map' && (
                  <span className={`rounded-full px-3 py-1 font-semibold ring-1 ${
                    cadastreError
                      ? 'bg-red-50 text-red-700 ring-red-100'
                      : hasAnyCadastreFeature
                        ? 'bg-green-50 text-green-700 ring-green-100'
                        : 'bg-secondary-100 text-secondary-600 ring-secondary-200'
                  }`}>
                    {cadastreLoading
                      ? 'Cadastre en chargement'
                      : cadastreError
                        ? 'Cadastre indisponible'
                        : hasAnyCadastreFeature
                          ? `${formatInteger(
                              cadastreFeatures.communes.length +
                              cadastreFeatures.sections.length +
                              cadastreFeatures.parcels.length +
                              cadastreFeatures.buildings.length
                            )} objets cadastre`
                          : 'Cadastre non importé'}
                  </span>
                )}
                {activeTab === 'map' && (
                  <span className={`rounded-full px-3 py-1 font-semibold ring-1 ${
                    dvfError
                      ? 'bg-red-50 text-red-700 ring-red-100'
                      : dvfMutations.length > 0
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                        : 'bg-secondary-100 text-secondary-600 ring-secondary-200'
                  }`}>
                    {dvfLoading
                      ? 'DVF en chargement'
                      : dvfError
                        ? 'DVF indisponible'
                        : `${formatInteger(dvfMutations.length)} DVF localisée${dvfMutations.length > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {selectedDepartmentOutOfScope && (
            <div className="mx-4 mt-4 rounded-2xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900 lg:mx-6">
              Ce département n'est pas inclus dans vos accès GetFlaire.
            </div>
          )}

          {hasNoAuthorizedDepartments && !loading && !error && (
            <div className="mx-4 mt-4 rounded-2xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900 lg:mx-6">
              Aucun département actif dans votre abonnement.
            </div>
          )}

          {error && (
            <div className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 lg:mx-6">
              Erreur Supabase lors du chargement des DPE : {error}
            </div>
          )}

          {cadastreError && activeTab === 'map' && (
            <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 lg:mx-6">
              Les couches cadastre ne sont pas encore disponibles sur cette base : {cadastreError}
            </div>
          )}

          {dvfError && activeTab === 'map' && (
            <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 lg:mx-6">
              Les mutations DVF localisées ne sont pas encore disponibles sur cette base : {dvfError}
            </div>
          )}

          {loading && mapPoints.length === 0 ? (
            <MapLoadingState />
          ) : (
            !hasNoAuthorizedDepartments && !error && (
              <>
                {activeTab === 'map' && (
                  <section className="prospection-map-shell">
                    <div className="h-[calc(100vh-9rem)] min-h-[520px] overflow-hidden md:h-[calc(100vh-10rem)] lg:h-[calc(100vh-8.5rem)] lg:min-h-[640px]">
                      <MapContainer
                        center={AUBE_CENTER}
                        zoom={12}
                        scrollWheelZoom
                        zoomControl={false}
                        className="h-full w-full"
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapAutoFit points={mapPoints} />
                        <CadastreMapWatcher
                          enabledLayers={activeCadastreLayers}
                          onBoundsChange={handleCadastreBoundsChange}
                        />
                        <DVFMapWatcher
                          enabled={visibleLayers.dvf}
                          onBoundsChange={handleDVFBoundsChange}
                        />
                        <MapZoomControls />
                        {activeCadastreLayers.map((layer) =>
                          (layer === 'parcels' ? scoredCadastreParcels : cadastreFeatures[layer])
                            .filter((feature) => feature.geometry)
                            .map((feature, index) => (
                              <GeoJSON
                                key={`${layer}-${feature.parcel_code || feature.commune_code || feature.id || index}`}
                                data={toLeafletFeature(feature)}
                                style={getCadastreStyle(layer)}
                              >
                                <Popup>
                                  <div className="space-y-2">
                                    <p className="text-sm font-black text-secondary-950">
                                      {layer === 'parcels'
                                        ? `Parcelle ${feature.parcel_code || '-'}`
                                        : layer === 'buildings'
                                          ? `Bâtiment ${feature.building_type || ''}`.trim()
                                          : feature.name || feature.commune_code || layer}
                                    </p>
                                    {feature.area_cadastre ? (
                                      <p className="text-xs font-semibold text-secondary-600">
                                        Contenance cadastrale : {formatInteger(feature.area_cadastre)} m²
                                      </p>
                                    ) : null}
                                    {'cadastreOpportunity' in feature && feature.cadastreOpportunity ? (
                                      <div className="rounded-2xl bg-orange-50 px-3 py-2">
                                        <p className="text-xs font-semibold text-orange-700">Score cadastre</p>
                                        <p className="text-2xl font-black text-orange-700">
                                          {feature.cadastreOpportunity.score}/100
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                          {feature.cadastreOpportunity.signals.slice(0, 3).map((signal) => (
                                            <span key={signal.label} className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${getSignalClasses(signal.tone)}`}>
                                              {signal.label}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}
                                    {feature.commune_code ? (
                                      <p className="text-xs text-secondary-500">Commune {feature.commune_code}</p>
                                    ) : null}
                                  </div>
                                </Popup>
                              </GeoJSON>
                            ))
                        )}
                        {parcelSearchResults
                          .filter((feature) => feature.geometry)
                          .map((feature, index) => (
                            <GeoJSON
                              key={`search-${feature.parcel_code || index}`}
                              data={toLeafletFeature(feature)}
                              style={{ color: '#16a34a', weight: 3, fillColor: '#22c55e', fillOpacity: 0.18 }}
                            >
                              <Popup>
                                <div className="space-y-2">
                                  <p className="text-sm font-black text-secondary-950">
                                    Parcelle {feature.parcel_code || '-'}
                                  </p>
                                  {feature.area_cadastre ? (
                                    <p className="text-xs font-semibold text-secondary-600">
                                      {formatInteger(feature.area_cadastre)} m² cadastraux
                                    </p>
                                  ) : null}
                                  {selectedParcelDetails?.buildings?.length ? (
                                    <p className="text-xs text-green-700">
                                      {selectedParcelDetails.buildings.length} bâtiment(s) lié(s)
                                    </p>
                                  ) : null}
                                </div>
                              </Popup>
                            </GeoJSON>
                          ))}
                        {visibleLayers.dpe && showZones && mapPoints.map((point) => (
                          <Circle
                            key={`zone-${point.id}`}
                            center={[point.latitude, point.longitude]}
                            radius={100}
                            pathOptions={{
                              color: getScoreColor(point.opportunityScore),
                              fillColor: getScoreColor(point.opportunityScore),
                              fillOpacity: 0.18,
                              opacity: 0.28,
                              weight: 1,
                            }}
                          />
                        ))}
                        {visibleLayers.dvf && dvfMutations.map((mutation) => (
                          <CircleMarker
                            key={mutation.mutation_key}
                            center={[mutation.latitude, mutation.longitude]}
                            radius={8}
                            pathOptions={{
                              color: '#047857',
                              fillColor: '#10b981',
                              fillOpacity: 0.72,
                              opacity: 0.9,
                              weight: 2,
                            }}
                          >
                            <Popup>
                              <div className="prospection-popup-card">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-lg font-black text-secondary-950">
                                      {formatCurrency(mutation.valeur_fonciere)}
                                    </p>
                                    <p className="mt-1 text-sm text-secondary-500">
                                      {[mutation.adresse, mutation.code_postal, mutation.nom_commune].filter(Boolean).join(', ') || '-'}
                                    </p>
                                  </div>
                                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                                    <ReceiptEuro className="h-5 w-5" />
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <InfoCell label="Date vente" value={formatDate(mutation.date_mutation)} />
                                  <InfoCell label="Nature" value={mutation.nature_mutation || '-'} />
                                  <InfoCell label="Type" value={mutation.type_local || '-'} />
                                  <InfoCell label="Surface" value={formatSurface(mutation.surface_reelle_bati)} />
                                </div>
                                <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                                  <p className="text-xs font-semibold text-emerald-700">Parcelle</p>
                                  <p className="mt-1 break-words text-sm font-black text-emerald-900">
                                    {mutation.id_parcelle || '-'}
                                  </p>
                                </div>
                              </div>
                            </Popup>
                          </CircleMarker>
                        ))}
                        {visibleLayers.dpe && mapPoints.map((point) => (
                          <Marker
                            key={point.id}
                            position={[point.latitude, point.longitude]}
                            icon={createScoreIcon(point.opportunityScore)}
                            eventHandlers={{
                              click: () => handleSelectPoint(point),
                            }}
                          >
                            <Popup>
                              <div className="prospection-popup-card">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-lg font-black text-secondary-950">
                                      {point.type_batiment || 'Bien'} - {formatSurface(point.surface)}
                                    </p>
                                    <p className="mt-1 text-sm text-secondary-500">
                                      {[point.adresse, point.code_postal, point.ville].filter(Boolean).join(', ') || '-'}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectPoint(point)}
                                    className="rounded-xl p-2 text-secondary-400 hover:bg-secondary-50"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                  <p className="text-xs font-semibold text-secondary-400">Score d'opportunité</p>
                                  <p className="mt-1 text-4xl font-black" style={{ color: getScoreColor(point.opportunityScore) }}>
                                    {point.opportunityScore}<span className="text-base font-bold text-secondary-400">/100</span>
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span className={`rounded-full border px-2 py-1 text-xs font-bold ${getEnergyBadgeClass(point.etiquette_dpe)}`}>
                                    DPE {point.etiquette_dpe || '-'}
                                  </span>
                                  <span className={`rounded-full border px-2 py-1 text-xs font-bold ${getEnergyBadgeClass(point.etiquette_ges)}`}>
                                    GES {point.etiquette_ges || '-'}
                                  </span>
                                  {point.energie_chauffage && (
                                    <span className="rounded-full bg-primary-50 px-2 py-1 text-xs font-bold text-primary-700">
                                      {point.energie_chauffage}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectPoint(point)}
                                    className="h-11 flex-1 rounded-xl bg-primary-500 text-sm font-black text-white hover:bg-primary-600"
                                  >
                                    Voir le détail
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectPoint(point)}
                                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-secondary-500 hover:bg-secondary-50"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>

                    {mapPoints.length === 0 && !loading && (
                      <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/62 p-6 backdrop-blur-[1px]">
                        <EmptyState
                          icon={MapPinned}
                          title="Aucun DPE géocodé visible pour vos accès actuels."
                          description={emptyMapDescription}
                          action={
                            <button
                              type="button"
                              onClick={resetFilters}
                              className="inline-flex items-center gap-2 rounded-xl bg-secondary-900 px-5 py-3 text-sm font-black text-white transition hover:bg-secondary-800"
                            >
                              Réinitialiser les filtres
                            </button>
                          }
                          className="border-0 bg-transparent"
                        />
                      </div>
                    )}

                    <div className="absolute bottom-4 left-4 z-[450] rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-secondary-600">
                        <span className="font-black text-secondary-900">Score d'opportunité</span>
                        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-red-500" />0-39</span>
                        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-orange-400" />40-59</span>
                        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" />60-79</span>
                        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-green-500" />80-100</span>
                      </div>
                    </div>

                    {(parcelSearchError || parcelSearchResults.length > 0) && (
                      <div className="absolute right-4 top-24 z-[450] w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-secondary-950">Recherche parcelle</p>
                            <p className="mt-1 text-xs text-secondary-500">{parcelSearch}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setParcelSearchResults([]);
                              setParcelSearchError(null);
                              setSelectedParcelDetails(null);
                            }}
                            className="rounded-full bg-secondary-100 px-2 py-1 text-xs font-black text-secondary-500"
                          >
                            Fermer
                          </button>
                        </div>
                        {parcelSearchError ? (
                          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                            {parcelSearchError}
                          </p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {parcelSearchResults.slice(0, 5).map((feature) => (
                              <div key={feature.parcel_code} className="rounded-xl bg-green-50 px-3 py-2 text-sm">
                                <p className="font-black text-green-800">{feature.parcel_code}</p>
                                <p className="text-xs text-green-700">
                                  {[feature.commune_code, feature.section_code, feature.parcel_number].filter(Boolean).join(' · ')}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!selectedDpe && mapPoints.length > 0 && !detailPanelOpen && (
                      <div className="absolute bottom-20 left-1/2 z-[440] w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl bg-secondary-950/88 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg backdrop-blur">
                        Cliquez sur un point pour ouvrir le détail DPE.
                      </div>
                    )}
                  </section>
                )}

                {activeTab === 'operations' && (
                  <div className="grid gap-4 px-4 pb-6 lg:grid-cols-12 lg:px-6">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:col-span-12">
                      <SummaryCard icon={Target} label="Opportunités fortes" value={topOpportunities.filter((point) => point.opportunityScore >= 80).length} hint="Biens prioritaires visibles maintenant." />
                      <SummaryCard icon={Flame} label="Passoires F/G" value={signalCounts.fg} hint="Diagnostics énergétiques les plus sensibles." />
                      <SummaryCard icon={MapPinned} label="Couverture géocodée" value={`${geocodedRatio}%`} hint="Part des DPE visibles avec coordonnées." />
                      <SummaryCard icon={BarChart3} label="Score moyen" value={`${averageScore}/100`} hint="Signal moyen sur les DPE actuellement chargés." />
                      <SummaryCard icon={Layers3} label="Signaux cadastre" value={cadastreStrongOpportunities} hint="Parcelles visibles avec potentiel cadastral." />
                      <SummaryCard icon={ReceiptEuro} label="DVF carte" value={formatInteger(dvfMutations.length)} hint="Mutations localisées dans l'emprise visible." />
                    </div>

                    <div className="lg:col-span-7">
                      <SectionCard
                        title="Lecture terrain"
                        subtitle="Répartition instantanée des signaux sur vos DPE visibles."
                        action={
                          <button
                            type="button"
                            onClick={() => setActiveTab('map')}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-white"
                          >
                            Ouvrir la carte
                            <ArrowUpRight className="h-4 w-4" />
                          </button>
                        }
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-3">
                            {scoreDistribution.map((bucket) => {
                              const width = mapPoints.length ? Math.max(12, Math.round((bucket.count / mapPoints.length) * 100)) : 0;
                              return (
                                <div key={bucket.label}>
                                  <div className="mb-1 flex items-center justify-between text-sm font-semibold text-secondary-700">
                                    <span>{bucket.label}</span>
                                    <span>{bucket.count}</span>
                                  </div>
                                  <div className="h-3 rounded-full bg-secondary-100">
                                    <div className={`${bucket.color} h-3 rounded-full`} style={{ width: `${width}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-secondary-500">DPE récents</p>
                              <p className="mt-2 text-2xl font-black text-secondary-950">{signalCounts.recent}</p>
                              <p className="mt-1 text-sm text-secondary-500">Moins de 90 jours.</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-secondary-500">Électrique</p>
                              <p className="mt-2 text-2xl font-black text-secondary-950">{signalCounts.electric}</p>
                              <p className="mt-1 text-sm text-secondary-500">Chauffage déclaré électrique.</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-secondary-500">Tertiaire</p>
                              <p className="mt-2 text-2xl font-black text-secondary-950">{signalCounts.tertiary}</p>
                              <p className="mt-1 text-sm text-secondary-500">Catégorie tertiaire chargée.</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-secondary-500">DPE visibles</p>
                              <p className="mt-2 text-2xl font-black text-secondary-950">{formatInteger(totalCount)}</p>
                              <p className="mt-1 text-sm text-secondary-500">Après RLS et filtres actifs.</p>
                            </div>
                          </div>
                        </div>
                      </SectionCard>
                    </div>

                    <div className="lg:col-span-5">
                      <SectionCard title="Communes les plus actives" subtitle="Concentration actuelle des DPE géocodés visibles.">
                        <div className="space-y-3">
                          {topCommunes.length > 0 ? topCommunes.map(([city, count], index) => (
                            <div key={city} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black text-secondary-700 ring-1 ring-gray-200">
                                  {index + 1}
                                </span>
                                <div>
                                  <p className="font-black text-secondary-950">{city}</p>
                                  <p className="text-sm text-secondary-500">DPE géocodés visibles</p>
                                </div>
                              </div>
                              <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-primary-700 ring-1 ring-primary-100">
                                {count}
                              </span>
                            </div>
                          )) : (
                            <EmptyState icon={Building2} title="Aucune commune à résumer" description="Charge quelques DPE géocodés pour voir la répartition par commune." className="border-0 bg-transparent px-0" />
                          )}
                        </div>
                      </SectionCard>
                    </div>

                    <div className="lg:col-span-12">
                      <SectionCard
                        title="Top opportunités"
                        subtitle="Les biens les plus forts dans les résultats visibles."
                        action={
                          <button
                            type="button"
                            onClick={() => setActiveTab('list')}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-secondary-700"
                          >
                            Ouvrir la liste
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        }
                      >
                        <div className="grid gap-3 lg:grid-cols-2">
                          {topOpportunities.map((point) => (
                            <button
                              key={point.id}
                              type="button"
                              onClick={() => handleSelectPoint(point)}
                              className="flex items-start justify-between rounded-2xl border border-gray-100 bg-slate-50 px-4 py-4 text-left transition hover:border-primary-200 hover:bg-primary-50/40"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-base font-black text-secondary-950">
                                  {point.adresse || 'Adresse non renseignée'}
                                </p>
                                <p className="mt-1 text-sm text-secondary-500">
                                  {[point.code_postal, point.ville].filter(Boolean).join(' ')}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <span className={`rounded-full border px-2 py-1 text-xs font-bold ${getEnergyBadgeClass(point.etiquette_dpe)}`}>
                                    DPE {point.etiquette_dpe || '-'}
                                  </span>
                                  {point.opportunitySignals.slice(0, 2).map((signal) => (
                                    <span key={signal.label} className={`rounded-full border px-2 py-1 text-xs font-bold ${getSignalClasses(signal.tone)}`}>
                                      {signal.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="ml-4 text-right">
                                <p className="text-2xl font-black" style={{ color: getScoreColor(point.opportunityScore) }}>
                                  {point.opportunityScore}
                                </p>
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary-400">score</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </SectionCard>
                    </div>
                  </div>
                )}

                {activeTab === 'list' && (
                  <div className="px-4 pb-6 lg:px-6">
                    <SectionCard title="Liste DPE" subtitle="Même périmètre que la carte, avec lecture tabulaire et ouverture du détail au clic.">
                      {mapPoints.length > 0 ? (
                        <div className="overflow-hidden rounded-3xl border border-gray-100">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100">
                              <thead className="bg-slate-50">
                                <tr className="text-left text-xs font-black uppercase tracking-[0.12em] text-secondary-500">
                                  <th className="px-4 py-3">Date</th>
                                  <th className="px-4 py-3">Bien</th>
                                  <th className="px-4 py-3">Ville</th>
                                  <th className="px-4 py-3">DPE / GES</th>
                                  <th className="px-4 py-3">Surface</th>
                                  <th className="px-4 py-3">Chauffage</th>
                                  <th className="px-4 py-3">Score</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {mapPoints.map((point) => (
                                  <tr
                                    key={point.id}
                                    onClick={() => handleSelectPoint(point)}
                                    className="cursor-pointer transition hover:bg-primary-50/50"
                                  >
                                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-secondary-600">
                                      {formatDate(point.date_etablissement_dpe)}
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="max-w-[18rem]">
                                        <p className="truncate font-black text-secondary-950">{point.adresse || '-'}</p>
                                        <p className="mt-1 text-sm text-secondary-500">{point.type_batiment || point.categorie_dpe || '-'}</p>
                                      </div>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-4 text-sm text-secondary-700">
                                      {[point.code_postal, point.ville].filter(Boolean).join(' ')}
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="flex gap-2">
                                        <span className={`rounded-full border px-2 py-1 text-xs font-bold ${getEnergyBadgeClass(point.etiquette_dpe)}`}>
                                          {point.etiquette_dpe || '-'}
                                        </span>
                                        <span className={`rounded-full border px-2 py-1 text-xs font-bold ${getEnergyBadgeClass(point.etiquette_ges)}`}>
                                          {point.etiquette_ges || '-'}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-secondary-700">
                                      {formatSurface(point.surface)}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-secondary-600">
                                      <div className="max-w-[12rem] truncate">{point.energie_chauffage || '-'}</div>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-4">
                                      <span
                                        className="inline-flex rounded-full px-3 py-1 text-sm font-black ring-1"
                                        style={{
                                          color: getScoreColor(point.opportunityScore),
                                          backgroundColor: `${getScoreColor(point.opportunityScore)}18`,
                                          boxShadow: `inset 0 0 0 1px ${getScoreColor(point.opportunityScore)}22`,
                                        }}
                                      >
                                        {point.opportunityScore}/100
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <EmptyState icon={ClipboardList} title="Aucun DPE à lister" description={emptyMapDescription} className="border-0 bg-transparent px-0" />
                      )}
                    </SectionCard>
                  </div>
                )}

                {activeTab === 'campaigns' && (
                  <div className="grid gap-4 px-4 pb-6 lg:grid-cols-12 lg:px-6">
                    <div className="lg:col-span-5">
                      <SectionCard title="Bien source" subtitle="La campagne v1 part du DPE actuellement sélectionné.">
                        {selectedDpe ? (
                          <div className="space-y-4">
                            <div className="rounded-[24px] bg-slate-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-lg font-black text-secondary-950">{selectedDpe.adresse || 'Adresse non renseignée'}</p>
                                  <p className="mt-1 text-sm text-secondary-500">{[selectedDpe.code_postal, selectedDpe.ville].filter(Boolean).join(' ')}</p>
                                </div>
                                <span className="rounded-2xl bg-white px-3 py-2 text-right ring-1 ring-gray-200">
                                  <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-secondary-400">Score</span>
                                  <span className="text-xl font-black" style={{ color: getScoreColor(selectedDpe.opportunityScore) }}>
                                    {selectedDpe.opportunityScore}
                                  </span>
                                </span>
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                <span className={`rounded-full border px-2 py-1 text-xs font-bold ${getEnergyBadgeClass(selectedDpe.etiquette_dpe)}`}>DPE {selectedDpe.etiquette_dpe || '-'}</span>
                                <span className={`rounded-full border px-2 py-1 text-xs font-bold ${getEnergyBadgeClass(selectedDpe.etiquette_ges)}`}>GES {selectedDpe.etiquette_ges || '-'}</span>
                                {selectedDpe.energie_chauffage ? (
                                  <span className="rounded-full bg-primary-50 px-2 py-1 text-xs font-bold text-primary-700">
                                    {selectedDpe.energie_chauffage}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-gray-100 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-secondary-500">Mode de génération</p>
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                {[
                                  { value: 'call', label: 'Appel' },
                                  { value: 'sms', label: 'SMS' },
                                  { value: 'both', label: 'Mixte' },
                                ].map((mode) => (
                                  <button
                                    key={mode.value}
                                    type="button"
                                    onClick={() => setCampaignMode(mode.value as OutreachMode)}
                                    className={`rounded-xl px-3 py-2 text-sm font-black transition ${
                                      campaignMode === mode.value
                                        ? 'bg-primary-500 text-white'
                                        : 'border border-gray-200 bg-white text-secondary-700'
                                    }`}
                                  >
                                    {mode.label}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleGenerateCampaign()}
                                disabled={campaignLoading}
                                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-black text-white disabled:opacity-60"
                              >
                                <Sparkles className="h-4 w-4" />
                                {campaignLoading ? 'Génération en cours...' : 'Générer les messages'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <EmptyState
                            icon={Megaphone}
                            title="Sélectionne un DPE pour préparer une campagne"
                            description="Choisis un point sur la carte ou une ligne dans la liste pour générer un angle d'approche réel."
                            action={
                              <div className="flex flex-wrap justify-center gap-2">
                                <button type="button" onClick={() => setActiveTab('map')} className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-white">Choisir sur la carte</button>
                                <button type="button" onClick={() => setActiveTab('list')} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-secondary-700">Choisir en liste</button>
                              </div>
                            }
                            className="border-0 bg-transparent px-0"
                          />
                        )}
                      </SectionCard>
                    </div>

                    <div className="lg:col-span-7">
                      <SectionCard title="Contenu généré" subtitle="V1 connectée à generate-outreach, avec fallback propre si la fonction distante manque.">
                        {campaignError ? (
                          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{campaignError}</div>
                        ) : null}

                        {campaignResult ? (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-secondary-700">
                                Source {campaignResult.source === 'ai' ? 'IA' : 'fallback'}
                              </span>
                              {campaignResult.fallbackMessage ? (
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                                  {campaignResult.fallbackMessage}
                                </span>
                              ) : null}
                            </div>

                            {campaignResult.callScripts.length > 0 && (
                              <div className="space-y-3">
                                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-secondary-500">Scripts d'appel</h3>
                                {campaignResult.callScripts.map((script) => (
                                  <div key={script.title} className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="font-black text-secondary-950">{script.title}</p>
                                        {script.angle ? <p className="mt-1 text-sm text-secondary-500">{script.angle}</p> : null}
                                      </div>
                                      <button type="button" onClick={() => void handleCopy(script.body)} className="rounded-xl border border-gray-200 bg-white p-2 text-secondary-500">
                                        <Copy className="h-4 w-4" />
                                      </button>
                                    </div>
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-secondary-700">{script.body}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {campaignResult.smsSuggestions.length > 0 && (
                              <div className="space-y-3">
                                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-secondary-500">Suggestions SMS</h3>
                                {campaignResult.smsSuggestions.map((sms) => (
                                  <div key={sms.title} className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="font-black text-secondary-950">{sms.title}</p>
                                        {sms.angle ? <p className="mt-1 text-sm text-secondary-500">{sms.angle}</p> : null}
                                      </div>
                                      <button type="button" onClick={() => void handleCopy(sms.body)} className="rounded-xl border border-gray-200 bg-white p-2 text-secondary-500">
                                        <Copy className="h-4 w-4" />
                                      </button>
                                    </div>
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-secondary-700">{sms.body}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <EmptyState icon={MessageSquareText} title="Pas encore de message généré" description="Lance une génération pour voir des scripts d'appel ou des suggestions SMS basés sur le DPE sélectionné." className="border-0 bg-transparent px-0" />
                        )}
                      </SectionCard>
                    </div>
                  </div>
                )}

                {activeTab === 'alerts' && (
                  <div className="grid gap-4 px-4 pb-6 lg:grid-cols-12 lg:px-6">
                    <div className="grid gap-4 sm:grid-cols-3 lg:col-span-12">
                      <SummaryCard icon={Bell} label="Notifications" value={notifications.length} hint="Dernières alertes intelligentes remontées." />
                      <SummaryCard icon={BadgeAlert} label="Non lues" value={unreadNotifications.length} hint="À traiter depuis le moteur d'alertes." />
                      <SummaryCard icon={Radar} label="Alertes actives" value={activeAlerts.length} hint="Recherches intelligentes actuellement en veille." />
                    </div>

                    <div className="lg:col-span-7">
                      <SectionCard
                        title="Notifications récentes"
                        subtitle="Flux condensé des alertes intelligentes déjà branchées à GetFlaire."
                        action={
                          <Link to="/alertes-intelligentes" className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-white">
                            Ouvrir le centre d'alertes
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        }
                      >
                        {alertsError ? (
                          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{alertsError}</div>
                        ) : notifications.length > 0 ? (
                          <div className="space-y-3">
                            {notifications.slice(0, 8).map((notification) => (
                              <div key={notification.id} className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-black text-secondary-950">{notification.contenu.title || 'Alerte intelligente'}</p>
                                      {!notification.read_at && (
                                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-black text-primary-700">nouveau</span>
                                      )}
                                    </div>
                                    <p className="mt-1 text-sm text-secondary-600">{notification.contenu.message || 'Aucun message détaillé.'}</p>
                                  </div>
                                  <span className="whitespace-nowrap text-xs font-semibold text-secondary-400">
                                    {formatDate(notification.created_at)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState icon={Bell} title={alertsLoading ? 'Chargement des alertes...' : 'Aucune notification récente'} description="Les prochaines remontées du moteur d'alertes intelligentes apparaîtront ici." className="border-0 bg-transparent px-0" />
                        )}
                      </SectionCard>
                    </div>

                    <div className="lg:col-span-5">
                      <SectionCard title="Recherches et matches" subtitle="Vue rapide avant d'aller dans la gestion avancée.">
                        <div className="space-y-3">
                          {activeAlerts.slice(0, 4).map((alert) => (
                            <div key={alert.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-black text-secondary-950">{alert.nom_alerte}</p>
                                  <p className="mt-1 text-sm text-secondary-500">
                                    {[alert.ville, alert.type_de_bien].filter(Boolean).join(' · ') || 'Recherche active'}
                                  </p>
                                </div>
                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800">
                                  {alert.priorite}
                                </span>
                              </div>
                            </div>
                          ))}

                          {alertResults.slice(0, 3).map((result: AlertMatchResult) => {
                            const badge = getSmartAlertBadge(result.score_pertinence);
                            return (
                              <div key={result.id} className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-black text-secondary-950">{result.annonce?.title || 'Annonce liée'}</p>
                                    <p className="mt-1 text-sm text-secondary-500">{result.resume}</p>
                                  </div>
                                  <span className={`rounded-full border px-2 py-1 text-xs font-black ${badge.tone}`}>
                                    {result.score_pertinence}/100
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {!activeAlerts.length && !alertResults.length && (
                            <EmptyState icon={Radar} title="Aucune alerte active ici pour l'instant" description="Le module Prospection est bien branché, mais il n'y a rien de significatif à remonter sur ce compte pour le moment." className="border-0 bg-transparent px-0" />
                          )}
                        </div>
                      </SectionCard>
                    </div>
                  </div>
                )}
              </>
            )
          )}

          {activeTab === 'map' && hasMore && !loading && mapPoints.length > 0 && (
            <div className="pb-4 pt-3 text-center">
              <button
                type="button"
                onClick={loadMore}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-3 font-black text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-600"
              >
                Charger plus de points
              </button>
            </div>
          )}
        </main>
      </div>

      {selectedDpe && detailPanelOpen && (
        <>
          <div className="prospection-overlay" onClick={() => setDetailPanelOpen(false)} />
          <aside className="prospection-detail-drawer prospection-side-shell">
            <DetailPanelContent
              selectedDpe={selectedDpe}
              onClose={() => {
                setDetailPanelOpen(false);
                setSelectedDpe(null);
              }}
            />
          </aside>
        </>
      )}

      {filtersPanelOpen && (
        <>
          <div className="prospection-overlay" onClick={() => setFiltersPanelOpen(false)} />
          <aside className="prospection-filters-drawer prospection-side-shell">
            <FiltersPanelContent
              filters={filters}
              scopedDepartments={scopedDepartments}
              quickFilters={quickFilters}
              loading={loading}
              mapPointsCount={mapPoints.length}
              totalCount={totalCount}
              updateFilter={updateFilter}
              toggleLabelFilter={toggleLabelFilter}
              resetFilters={resetFilters}
              refresh={() => {
                refresh();
                setFiltersPanelOpen(false);
              }}
            />
          </aside>
        </>
      )}
    </div>
  );
};

export default ProspectionPage;
