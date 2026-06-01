import React, { useState } from 'react';

export default function AcademicStructureStep({ onSave, initialData = {} }) {
  const [levels, setLevels] = useState(initialData.levels || []);
  const [newLevelName, setNewLevelName] = useState('');

  function addLevel() {
    if (newLevelName.trim()) {
      setLevels([...levels, { id: Date.now(), name: newLevelName, classes: [] }]);
      setNewLevelName('');
    }
  }

  function removeLevel(id) {
    setLevels(levels.filter(l => l.id !== id));
  }

  function addClassToLevel(levelId) {
    setLevels(levels.map(l => 
      l.id === levelId 
        ? { ...l, classes: [...l.classes, { id: Date.now(), name: '' }] }
        : l
    ));
  }

  function updateClassName(levelId, classId, name) {
    setLevels(levels.map(l =>
      l.id === levelId
        ? { ...l, classes: l.classes.map(c => c.id === classId ? { ...c, name } : c) }
        : l
    ));
  }

  function removeClass(levelId, classId) {
    setLevels(levels.map(l =>
      l.id === levelId
        ? { ...l, classes: l.classes.filter(c => c.id !== classId) }
        : l
    ));
  }

  return (
    <div className="space-y-6">
      {/* Add Level */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newLevelName}
          onChange={(e) => setNewLevelName(e.target.value)}
          placeholder="e.g., Primary, Secondary, JHS"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={addLevel}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Add Level
        </button>
      </div>

      {/* Levels List */}
      <div className="space-y-6">
        {levels.map((level) => (
          <div key={level.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">{level.name}</h3>
              <button
                onClick={() => removeLevel(level.id)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>

            {/* Classes */}
            <div className="space-y-2 mb-4">
              {level.classes.map((cls) => (
                <div key={cls.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={cls.name}
                    onChange={(e) => updateClassName(level.id, cls.id, e.target.value)}
                    placeholder="Class name (e.g., Form 1A)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => removeClass(level.id, cls.id)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Add Class Button */}
            <button
              onClick={() => addClassToLevel(level.id)}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              + Add Class
            </button>
          </div>
        ))}
      </div>

      {/* Summary */}
      {levels.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-700">
            <strong>{levels.length}</strong> levels with <strong>{levels.reduce((sum, l) => sum + l.classes.length, 0)}</strong> classes total
          </p>
        </div>
      )}
    </div>
  );
}
