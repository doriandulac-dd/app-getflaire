import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getDepartmentLabels } from './useProperties';
import { normalizeDepartmentCodes, normalizeDepartmentCode } from '../utils/pigeScope';

export type DPERecord = {
  id: string;
  numero_dpe: string | null;
  source_fichier: string | null;
  periode_dpe: string | null;
  categorie_dpe: string | null;
  date_etablissement_dpe: string | null;
  etiquette_dpe: string | null;
  etiquette_ges: string | null;
  type_batiment: string | null;
  surface: number | null;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  departement: string | null;
  latitude: number | null;
  longitude: number | null;
  energie_chauffage: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DPEFilters = {
  search?: string;
  departement?: string;
  ville?: string;
  code_postal?: string;
  etiquette_dpe?: string[];
  etiquette_ges?: string[];
  categorie_dpe?: string;
  periode_dpe?: string;
  date_min?: string;
  date_max?: string;
  surface_min?: number;
  surface_max?: number;
  energie_chauffage?: string;
};

export type DPESortOption = {
  field: 'date_etablissement_dpe' | 'ville' | 'etiquette_dpe' | 'surface';
  direction: 'asc' | 'desc';
};

type UseDPEProspectionOptions = {
  filters?: DPEFilters;
  sort?: DPESortOption;
  authorizedDepartments?: string[];
  limit?: number;
  mapOnly?: boolean;
};

type DPEQueryBuilder = {
  in: (column: string, values: string[]) => DPEQueryBuilder;
  ilike: (column: string, pattern: string) => DPEQueryBuilder;
  like: (column: string, pattern: string) => DPEQueryBuilder;
  eq: (column: string, value: string) => DPEQueryBuilder;
  gte: (column: string, value: string | number) => DPEQueryBuilder;
  lte: (column: string, value: string | number) => DPEQueryBuilder;
  or: (filters: string) => DPEQueryBuilder;
  not: (column: string, operator: string, value: null) => DPEQueryBuilder;
};

export type DPEDiagnostic = {
  departmentQueryValues: string[];
  visibleRowsWithoutCoordinates: number | null;
  zeroResultReason: 'no_authorized_departments' | 'department_out_of_scope' | 'no_coordinates' | 'no_visible_rows' | null;
};

const DPE_COLUMNS = [
  'id',
  'numero_dpe',
  'source_fichier',
  'periode_dpe',
  'categorie_dpe',
  'date_etablissement_dpe',
  'etiquette_dpe',
  'etiquette_ges',
  'type_batiment',
  'surface',
  'adresse',
  'ville',
  'code_postal',
  'departement',
  'latitude',
  'longitude',
  'energie_chauffage',
  'created_at',
  'updated_at',
].join(', ');

const DEFAULT_SORT: DPESortOption = {
  field: 'date_etablissement_dpe',
  direction: 'desc',
};

const sanitizeOrValue = (value: string) => value.replace(/[,%]/g, ' ').trim();

const getDepartmentStorageVariants = (department: string) => {
  if (!department) return [];
  if (department === '2A' || department === '2B') return [department];

  const numeric = department.replace(/\D/g, '');
  if (!numeric) return [department];

  const withoutLeadingZeros = String(Number(numeric));
  return Array.from(new Set([
    department,
    numeric.padStart(2, '0'),
    numeric.padStart(3, '0'),
    withoutLeadingZeros,
    ...getDepartmentLabels(department),
  ].filter(Boolean)));
};

const getDepartmentScopeValues = (departments: string[]) =>
  Array.from(new Set(departments.flatMap(getDepartmentStorageVariants)));

export const useDPEProspection = ({
  filters = {},
  sort = DEFAULT_SORT,
  authorizedDepartments = [],
  limit = 50,
  mapOnly = false,
}: UseDPEProspectionOptions) => {
  const [dpeRows, setDpeRows] = useState<DPERecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [visibleRowsWithoutCoordinates, setVisibleRowsWithoutCoordinates] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const scopedDepartments = useMemo(
    () => normalizeDepartmentCodes(authorizedDepartments),
    [authorizedDepartments]
  );
  const scopedDepartmentsKey = scopedDepartments.join('|');
  const departmentQueryValues = useMemo(
    () => getDepartmentScopeValues(scopedDepartments),
    [scopedDepartments]
  );
  const departmentQueryValuesKey = departmentQueryValues.join('|');

  const selectedDepartment = useMemo(
    () => normalizeDepartmentCode(filters.departement),
    [filters.departement]
  );
  const selectedDepartmentValues = useMemo(
    () => getDepartmentStorageVariants(selectedDepartment),
    [selectedDepartment]
  );

  const selectedDepartmentOutOfScope = Boolean(
    selectedDepartment &&
    !selectedDepartmentValues.some((department) => departmentQueryValues.includes(department))
  );

  const applyFilters = useCallback(
    <T,>(baseQuery: T, requireCoordinates = mapOnly): T => {
      let query = baseQuery as unknown as DPEQueryBuilder;

      query = query.in(
        'departement',
        selectedDepartment ? selectedDepartmentValues : departmentQueryValues
      );

      if (filters.ville?.trim()) {
        query = query.ilike('ville', `%${filters.ville.trim()}%`);
      }

      if (filters.code_postal?.trim()) {
        query = query.like('code_postal', `${filters.code_postal.trim()}%`);
      }

      if (filters.etiquette_dpe?.length) {
        query = query.in('etiquette_dpe', filters.etiquette_dpe);
      }

      if (filters.etiquette_ges?.length) {
        query = query.in('etiquette_ges', filters.etiquette_ges);
      }

      if (filters.categorie_dpe) {
        query = query.eq('categorie_dpe', filters.categorie_dpe);
      }

      if (filters.periode_dpe) {
        query = query.eq('periode_dpe', filters.periode_dpe);
      }

      if (filters.date_min) {
        query = query.gte('date_etablissement_dpe', filters.date_min);
      }

      if (filters.date_max) {
        query = query.lte('date_etablissement_dpe', filters.date_max);
      }

      if (filters.surface_min !== undefined) {
        query = query.gte('surface', filters.surface_min);
      }

      if (filters.surface_max !== undefined) {
        query = query.lte('surface', filters.surface_max);
      }

      if (filters.energie_chauffage) {
        query = query.eq('energie_chauffage', filters.energie_chauffage);
      }

      if (filters.search?.trim()) {
        const search = sanitizeOrValue(filters.search);
        if (search) {
          query = query.or(
            `adresse.ilike.%${search}%,ville.ilike.%${search}%,numero_dpe.ilike.%${search}%`
          );
        }
      }

      if (requireCoordinates) {
        query = query.not('latitude', 'is', null).not('longitude', 'is', null);
      }

      return query as T;
    },
    [departmentQueryValues, filters, mapOnly, selectedDepartment, selectedDepartmentValues]
  );

  const fetchDPE = useCallback(
    async (reset = false) => {
      const requestId = ++requestIdRef.current;

      try {
        setLoading(true);
        setError(null);

        if (reset) {
          setPage(1);
          setDpeRows([]);
          setTotalCount(0);
          setHasMore(false);
          setVisibleRowsWithoutCoordinates(null);
        }

        if (scopedDepartments.length === 0 || departmentQueryValues.length === 0 || selectedDepartmentOutOfScope) {
          setDpeRows([]);
          setTotalCount(0);
          setHasMore(false);
          setVisibleRowsWithoutCoordinates(null);
          setPage(1);
          return;
        }

        const from = reset ? 0 : (page - 1) * limit;
        const to = from + limit - 1;

        const dataQuery = applyFilters(
          supabase
            .from('dpe')
            .select(DPE_COLUMNS, { count: 'planned' })
        )
          .order(sort.field, { ascending: sort.direction === 'asc', nullsFirst: false })
          .range(from, to);

        const { data, error: queryError, count } = await dataQuery;
        if (queryError) throw queryError;
        if (requestId !== requestIdRef.current) return;

        const nextRows = (data || []) as DPERecord[];
        const nextTotalCount = reset && nextRows.length === 0
          ? 0
          : count ?? (reset ? nextRows.length : Math.max(totalCount, dpeRows.length + nextRows.length));

        if (reset) {
          setDpeRows(nextRows);
          setPage(2);
        } else {
          setDpeRows((previous) => {
            const existingIds = new Set(previous.map((row) => row.id));
            return [...previous, ...nextRows.filter((row) => !existingIds.has(row.id))];
          });
          setPage((previous) => previous + 1);
        }

        setTotalCount(nextTotalCount);
        setHasMore(nextRows.length === limit && from + nextRows.length < nextTotalCount);

        if (reset && mapOnly && nextTotalCount === 0) {
          const diagnosticQuery = applyFilters(
            supabase
              .from('dpe')
              .select('id', { count: 'exact', head: true }),
            false
          );
          const { error: diagnosticError, count: diagnosticCount } = await diagnosticQuery;
          if (diagnosticError) throw diagnosticError;
          if (requestId !== requestIdRef.current) return;
          setVisibleRowsWithoutCoordinates(diagnosticCount ?? 0);
        } else if (reset) {
          setVisibleRowsWithoutCoordinates(null);
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement des DPE');
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [
      applyFilters,
      departmentQueryValues.length,
      dpeRows.length,
      limit,
      page,
      mapOnly,
      scopedDepartments.length,
      selectedDepartmentOutOfScope,
      sort.direction,
      sort.field,
      totalCount,
    ]
  );

  const refresh = useCallback(() => {
    void fetchDPE(true);
  }, [fetchDPE]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      void fetchDPE(false);
    }
  }, [fetchDPE, hasMore, loading]);

  useEffect(() => {
    void fetchDPE(true);
    // Keep automatic reloads tied to user-facing query inputs only.
    // Pagination state changes are handled by `loadMore`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort, limit, mapOnly, scopedDepartmentsKey, departmentQueryValuesKey, selectedDepartmentOutOfScope]);

  const diagnostic: DPEDiagnostic = {
    departmentQueryValues,
    visibleRowsWithoutCoordinates,
    zeroResultReason: scopedDepartments.length === 0
      ? 'no_authorized_departments'
      : selectedDepartmentOutOfScope
        ? 'department_out_of_scope'
        : totalCount === 0 && visibleRowsWithoutCoordinates !== null
          ? visibleRowsWithoutCoordinates > 0
            ? 'no_coordinates'
            : 'no_visible_rows'
          : null,
  };

  return {
    dpeRows,
    loading,
    error,
    hasMore,
    totalCount,
    loadedCount: dpeRows.length,
    scopedDepartments,
    selectedDepartmentOutOfScope,
    diagnostic,
    refresh,
    loadMore,
  };
};
