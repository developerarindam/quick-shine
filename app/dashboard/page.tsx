import React from "react";



export default function DashboardLayout() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div className="bg-white p-4 rounded-2xl shadow">
      <h2 className="text-sm text-gray-500">Total Sale</h2>
      <p className="text-2xl font-bold">120</p>
    </div>
    <div className="bg-white p-4 rounded-2xl shadow">
      <h2 className="text-sm text-gray-500">Expeses</h2>
      <p className="text-2xl font-bold">₹25,000</p>
    </div>
    <div className="bg-white p-4 rounded-2xl shadow">
      <h2 className="text-sm text-gray-500">Net Profit</h2>
      <p className="text-2xl font-bold">320</p>
    </div>
  </div>
  );
}
