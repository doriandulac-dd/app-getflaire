import React, { useState, useEffect } from 'react';
import { Save, Building, Hash, MapPin, Mail } from 'lucide-react';
import { useStripe } from '../../hooks/useStripe';
import { BillingInfo } from '../../types/billing';

const BillingInfoForm: React.FC = () => {
  const { billingInfo, updateBillingInfo, loading } = useStripe();
  const [form, setForm] = useState<BillingInfo>({
    company: '',
    vat: '',
    address: '',
    email: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(billingInfo);
  }, [billingInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await updateBillingInfo(form);
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof BillingInfo, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <section className="p-6 rounded-2xl shadow-sm border border-gray-200 bg-white">
        <h3 className="text-lg font-semibold text-secondary-900 mb-4">Informations de facturation</h3>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="p-6 rounded-2xl shadow-sm border border-gray-200 bg-white">
      <h3 className="text-lg font-semibold text-secondary-900 mb-4">
        Informations de facturation
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            <Building className="h-4 w-4 inline mr-1" />
            Société
          </label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => handleInputChange('company', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-primary-500 focus:border-primary-500"
            placeholder="Nom de votre société"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            <Hash className="h-4 w-4 inline mr-1" />
            Numéro de TVA
          </label>
          <input
            type="text"
            value={form.vat}
            onChange={(e) => handleInputChange('vat', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-primary-500 focus:border-primary-500"
            placeholder="FR12345678901"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            <MapPin className="h-4 w-4 inline mr-1" />
            Adresse de facturation
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-primary-500 focus:border-primary-500"
            placeholder="123 Rue de la Paix, 75001 Paris"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            <Mail className="h-4 w-4 inline mr-1" />
            Email de facturation
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-primary-500 focus:border-primary-500"
            placeholder="facturation@votre-societe.com"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center px-4 py-2 bg-secondary-900 text-white rounded-xl hover:bg-secondary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Sauvegarder
        </button>
      </form>
    </section>
  );
};

export default BillingInfoForm;