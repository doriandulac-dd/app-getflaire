import React, { useState, useMemo } from 'react';
import { MapPin, X, Plus, Info } from 'lucide-react';

interface RegionDeptPickerProps {
  selectedPlan: 'independant' | 'agence';
  selectedDepartments: string[];
  onDepartmentsChange: (departments: string[]) => void;
  maxDepartmentsAllowed: number;
}

// Carte code -> nom (métropole)
export const DEPT_LABELS: Record<string, string> = {
  '01': 'Ain','02':'Aisne','03':'Allier','04':'Alpes-de-Haute-Provence','05':'Hautes-Alpes',
  '06':'Alpes-Maritimes','07':'Ardèche','08':'Ardennes','09':'Ariège','10':'Aube',
  '11':'Aude','12':'Aveyron','13':'Bouches-du-Rhône','14':'Calvados','15':'Cantal',
  '16':'Charente','17':'Charente-Maritime','18':'Cher','19':'Corrèze','21':'Côte-d’Or',
  '22':'Côtes-d’Armor','23':'Creuse','24':'Dordogne','25':'Doubs','26':'Drôme',
  '27':'Eure','28':'Eure-et-Loir','29':'Finistère','2A':'Corse-du-Sud','2B':'Haute-Corse',
  '30':'Gard','31':'Haute-Garonne','32':'Gers','33':'Gironde','34':'Hérault','35':'Ille-et-Vilaine',
  '36':'Indre','37':'Indre-et-Loire','38':'Isère','39':'Jura','40':'Landes','41':'Loir-et-Cher',
  '42':'Loire','43':'Haute-Loire','44':'Loire-Atlantique','45':'Loiret','46':'Lot','47':'Lot-et-Garonne',
  '48':'Lozère','49':'Maine-et-Loire','50':'Manche','51':'Marne','52':'Haute-Marne','53':'Mayenne',
  '54':'Meurthe-et-Moselle','55':'Meuse','56':'Morbihan','57':'Moselle','58':'Nièvre','59':'Nord',
  '60':'Oise','61':'Orne','62':'Pas-de-Calais','63':'Puy-de-Dôme','64':'Pyrénées-Atlantiques',
  '65':'Hautes-Pyrénées','66':'Pyrénées-Orientales','67':'Bas-Rhin','68':'Haut-Rhin','69':'Rhône',
  '70':'Haute-Saône','71':'Saône-et-Loire','72':'Sarthe','73':'Savoie','74':'Haute-Savoie',
  '75':'Paris','76':'Seine-Maritime','77':'Seine-et-Marne','78':'Yvelines','79':'Deux-Sèvres',
  '80':'Somme','81':'Tarn','82':'Tarn-et-Garonne','83':'Var','84':'Vaucluse','85':'Vendée',
  '86':'Vienne','87':'Haute-Vienne','88':'Vosges','89':'Yonne','90':'Territoire de Belfort',
  '91':'Essonne','92':'Hauts-de-Seine','93':'Seine-Saint-Denis','94':'Val-de-Marne','95':'Val-d’Oise'
};

const SUGGESTIONS = Object.keys(DEPT_LABELS);

const RegionDeptPicker: React.FC<RegionDeptPickerProps> = ({
  selectedPlan,
  selectedDepartments,
  onDepartmentsChange,
  maxDepartmentsAllowed,
}) => {
  const [deptInput, setDeptInput] = useState('');

  const canAddMore = selectedDepartments.length < maxDepartmentsAllowed;

  const addDepartment = (codeRaw: string) => {
    const code = codeRaw.trim().toUpperCase();
    if (!code) return;
    if (!DEPT_LABELS[code]) return; // ignore codes inconnus
    if (selectedDepartments.includes(code)) return;
    if (!canAddMore) return;

    onDepartmentsChange([...selectedDepartments, code]);
    setDeptInput('');
  };

  const removeDepartment = (code: string) => {
    onDepartmentsChange(selectedDepartments.filter(c => c !== code));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addDepartment(deptInput);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-secondary-900">
        Sélectionnez vos départements
      </h3>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-secondary-700 mb-3">
          <Info className="h-4 w-4" />
          <span>
            Vous pouvez sélectionner <strong>{maxDepartmentsAllowed}</strong> département(s) au total
            (1 inclus dans le plan + {maxDepartmentsAllowed - 1} extension{maxDepartmentsAllowed - 1 > 1 ? 's' : ''}).
          </span>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={deptInput}
            onChange={(e) => setDeptInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: 10 ou 2A"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            onClick={() => addDepartment(deptInput)}
            disabled={!canAddMore}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {!canAddMore && (
          <p className="text-xs text-red-600 mb-2">
            Limite atteinte. Augmentez vos “Départements supplémentaires” dans les extensions.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          {selectedDepartments.map((code) => (
            <span
              key={code}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 text-primary-800 border border-primary-200"
            >
              <MapPin className="h-3 w-3 mr-1" />
              {code} — {DEPT_LABELS[code] || 'Inconnu'}
              <button
                onClick={() => removeDepartment(code)}
                className="ml-2 text-primary-600 hover:text-primary-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <div>
          <p className="text-xs text-secondary-500 mb-2">Suggestions :</p>
          <div className="flex flex-wrap gap-1">
            {SUGGESTIONS.slice(0, 24).map((code) => {
              const disabled = selectedDepartments.includes(code) || !canAddMore;
              return (
                <button
                  key={code}
                  onClick={() => addDepartment(code)}
                  disabled={disabled}
                  className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {code} — {DEPT_LABELS[code]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionDeptPicker;