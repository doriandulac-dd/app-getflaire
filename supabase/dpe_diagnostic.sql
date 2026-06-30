-- Diagnostic lecture seule pour comprendre pourquoi la carte Prospection
-- n'affiche aucun point DPE.

select
  count(*) as total_dpe,
  count(*) filter (where latitude is not null and longitude is not null) as dpe_geocodes,
  count(*) filter (where departement in ('10', '010')) as dpe_aube,
  count(*) filter (
    where departement in ('10', '010')
      and latitude is not null
      and longitude is not null
  ) as dpe_aube_geocodes
from public.dpe;

select
  departement,
  public.normalize_department_scope(departement) as departement_normalise,
  count(*) as total,
  count(*) filter (where latitude is not null and longitude is not null) as geocodes
from public.dpe
group by departement
order by total desc
limit 30;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename = 'dpe';

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
