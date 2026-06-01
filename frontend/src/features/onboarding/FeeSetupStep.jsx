import React, { useState } from 'react';

export default function FeeSetupStep({ onSave, initialData = {} }) {
  const [feeItems, setFeeItems] = useState(initialData.feeItems || []);
  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState('');
  const [paymentPlan, setPaymentPlan] = useState(initialData.paymentPlan || '100');

  function addFeeItem() {
    if (itemName.trim() && itemAmount.trim()) {
      setFeeItems([...feeItems, {
        id: Date.now(),
        name: itemName,
        amount: parseFloat(itemAmount),
      }]);
      setItemName('');
      setItemAmount('');
    }
  }

  function removeFeeItem(id) {
    setFeeItems(feeItems.filter(f => f.id !== id));
  }

  const totalFees = feeItems.reduce((sum, f) => sum + f.amount, 0);
  const installments = paymentPlan === '50' ? 2 : paymentPlan === '33' ? 3 : 1;
  const perInstallment = (totalFees / installments).toFixed(2);

  const commonItems = [
    'Tuition Fee',
    'Registration Fee',
    'Sports Fee',
    'Exam Fee',
    'PTA Contribution',
  ];

  function addCommonItem(name) {
    if (!feeItems.find(f => f.name === name)) {
      setFeeItems([...feeItems, { id: Date.now(), name, amount: 0 }]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Fee Item Input */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <p className="font-semibold text-gray-800 mb-4">Add Fee Item</p>
        <div className="space-y-3">
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Fee item name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="number"
            value={itemAmount}
            onChange={(e) => setItemAmount(e.target.value)}
            placeholder="Amount"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={addFeeItem}
            className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
          >
            Add Item
          </button>
        </div>

        {/* Quick Add */}
        <div className="mt-4 pt-4 border-t border-gray-300">
          <p className="text-sm text-gray-600 mb-2">Quick add:</p>
          <div className="flex flex-wrap gap-2">
            {commonItems.map((item) => (
              <button
                key={item}
                onClick={() => addCommonItem(item)}
                disabled={feeItems.find(f => f.name === item)}
                className="px-2 py-1 text-xs bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fee Items List */}
      <div>
        <p className="font-semibold text-gray-800 mb-3">Fee Items ({feeItems.length})</p>
        <div className="space-y-2">
          {feeItems.map((item) => (
            <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
              <div>
                <p className="font-medium text-gray-800">{item.name}</p>
                <p className="text-sm text-gray-600">₦{item.amount.toLocaleString()}</p>
              </div>
              <button
                onClick={() => removeFeeItem(item.id)}
                className="text-red-600 hover:text-red-700"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Total and Payment Plan */}
      {feeItems.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600 mb-4">
            <span className="font-semibold">Total Annual Fee:</span> ₦{totalFees.toLocaleString()}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Plan</label>
            <select
              value={paymentPlan}
              onChange={(e) => setPaymentPlan(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="100">Full payment (1 installment)</option>
              <option value="50">50-50 split (2 installments)</option>
              <option value="33">33-33-33 split (3 installments)</option>
            </select>
          </div>

          <p className="text-sm text-gray-600 mt-3">
            <span className="font-semibold">Per installment:</span> ₦{perInstallment}
          </p>
        </div>
      )}
    </div>
  );
}
