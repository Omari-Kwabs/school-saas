import React, { useState } from 'react';

const MOCK_SEARCH_DATA = [
  { id: 1, type: 'school', label: 'St. Johns Academy', category: 'Schools' },
  { id: 2, type: 'school', label: 'Elite Academy', category: 'Schools' },
  { id: 3, type: 'user', label: 'John Doe (Admin)', category: 'Users' },
  { id: 4, type: 'alert', label: 'Payment Overdue Alert', category: 'Alerts' },
  { id: 5, type: 'action', label: 'Resend Invite', category: 'Quick Actions' },
  { id: 6, type: 'action', label: 'Trigger Onboarding', category: 'Quick Actions' },
];

export default function OmniSearch({ onSelect = () => {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = (value) => {
    setQuery(value);
    if (value.length === 0) {
      setResults([]);
    } else {
      const filtered = MOCK_SEARCH_DATA.filter(
        item =>
          item.label.toLowerCase().includes(value.toLowerCase()) ||
          item.category.toLowerCase().includes(value.toLowerCase())
      );
      setResults(filtered);
    }
  };

  const handleSelect = (result) => {
    onSelect(result);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  // Group results by category
  const grouped = results.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search schools, users, alerts..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <span className="absolute right-3 top-2.5 text-gray-400">🔍</span>
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
          {query === '' ? (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">Start typing to search...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">No results found for "{query}"</p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 uppercase">{category}</p>
                </div>
                {items.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className="w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                  >
                    <span className="text-lg">
                      {item.type === 'school' ? '🏫' : item.type === 'user' ? '👤' : item.type === 'alert' ? '⚠️' : '⚡'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}

          {/* Keyboard hint */}
          <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-center">
            <p className="text-xs text-gray-500">Press ESC to close</p>
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
