import React, { useState } from 'react';

export default function SchoolIdentityStep({ onSave, initialData = {} }) {
  const [schoolName, setSchoolName] = useState(initialData.schoolName || '');
  const [motto, setMotto] = useState(initialData.motto || '');
  const [logoPreview, setLogoPreview] = useState(initialData.logoUrl || '');
  const [primaryColor, setPrimaryColor] = useState(initialData.primaryColor || '#4f46e5');

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setLogoPreview(evt.target?.result || '');
      };
      reader.readAsDataURL(file);
    }
  }

  function handleSave() {
    onSave({
      schoolName,
      motto,
      logoUrl: logoPreview,
      primaryColor,
    });
  }

  return (
    <div className="space-y-6">
      {/* School Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">School Name *</label>
        <input
          type="text"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          placeholder="e.g., St. John's Academy"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Motto */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Motto / Tagline</label>
        <input
          type="text"
          value={motto}
          onChange={(e) => setMotto(e.target.value)}
          placeholder="e.g., Excellence in Education"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Logo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">School Logo</label>
        <div className="flex gap-4 items-start">
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
              id="logo-upload"
            />
            <label
              htmlFor="logo-upload"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
            >
              Choose Image
            </label>
            <p className="text-xs text-gray-500 mt-1">Max 2MB, PNG or JPG</p>
          </div>
          {logoPreview && (
            <img src={logoPreview} alt="Logo preview" className="w-16 h-16 rounded-lg object-contain" />
          )}
        </div>
      </div>

      {/* Primary Color */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
        <div className="flex gap-4 items-center">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="w-16 h-10 rounded-lg cursor-pointer"
          />
          <span className="text-sm text-gray-500">{primaryColor}</span>
        </div>
      </div>

      {/* Preview */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-4">Preview</p>
        <div
          className="p-6 rounded-lg text-white"
          style={{ background: primaryColor }}
        >
          <p className="font-bold text-lg">{schoolName || 'School Name'}</p>
          <p className="text-sm opacity-90">{motto || 'School motto'}</p>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
      >
        Save School Identity
      </button>
    </div>
  );
}
