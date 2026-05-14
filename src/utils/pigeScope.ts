import { getDepartmentLabels, normalizeDepartments } from '../hooks/useProperties';

export const normalizeDepartmentCode = (value?: string | null) => {
  const raw = (value || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw === '2A' || raw === '2B') return raw;

  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(2, '0').slice(0, 3);
};

export const normalizeDepartmentCodes = (departments?: string[]) =>
  normalizeDepartments(departments);

export const buildDepartmentScopeFilter = (departments?: string[]) => {
  const scopedDepartments = normalizeDepartments(departments);

  return scopedDepartments.flatMap((department) => {
    const postalPrefix = department === '2A' || department === '2B' ? '20' : department;
    return [
      `departement.eq.${department}`,
      `postal_code.like.${postalPrefix}%`,
      ...getDepartmentLabels(department).map((label) => `departement.ilike.%${label}%`),
    ];
  });
};
