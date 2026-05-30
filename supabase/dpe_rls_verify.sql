-- Vérification après application de
-- supabase/migrations/20260530020000_dpe_authorized_departments_rls.sql

select
  public.normalize_department_scope('Aube') as aube,
  public.normalize_department_scope('10') as code_10,
  public.normalize_department_scope('010') as code_010;

select
  id,
  email,
  departements_autorises,
  array(
    select public.normalize_department_scope(departement)
    from unnest(coalesce(departements_autorises, '{}'::text[])) as allowed(departement)
  ) as departements_normalises
from public.users
where email ilike '%dorian%';

select
  departement,
  public.normalize_department_scope(departement) as departement_normalise,
  count(*) as total,
  count(*) filter (where latitude is not null and longitude is not null) as geocodes
from public.dpe
where public.normalize_department_scope(departement) = '10'
group by departement
order by total desc;
