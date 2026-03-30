"use client";

import React, { useEffect, useState } from "react";

// 🔹 Interfaces (unchanged)
export interface Bike {
  _id: string;
  bikeNumber: string;
  ownerName: string;
  phone: string;
  model: string;
}

export interface Service {
  _id: string;
  name: string;
  price: number;
}

export interface ServiceItem {
  _id: string;
  serviceId: Service;
  price: number;
}

export interface ServiceEntry {
  _id: string;
  bikeId: Bike;
  services: ServiceItem[];
  subtotal: number;
  discount: number;
  discountType: "flat" | "percent";
  total: number;
  date: string;
}

interface ServiceEntryResponse {
  data: ServiceEntry[];
  success: boolean;
}

export default function ServiceEntryPage() {
  const [entries, setEntries] = useState<ServiceEntry[]>([]);
  const [search, setSearch] = useState("");

  // 🔹 Fetch Entries
  const fetchEntries = async () => {
    const res = await fetch("/api/service-entry");
    const data: ServiceEntryResponse = await res.json();
    if(!data.success) {
      alert("Failed to fetch entries");
      return;
    }
    setEntries(data.data);
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // 🔹 Filter Logic (Aligned with business object)
console.log("Filtering entries with search:", entries);

  const filteredEntries = entries.filter((entry) => {
    const keyword = search.toLowerCase();

    return (
      entry.bikeId.bikeNumber.toLowerCase().includes(keyword) ||
      entry.bikeId.ownerName.toLowerCase().includes(keyword) ||
      entry.bikeId.phone.includes(keyword)
    );
  });

  // 🔹 Delete Entry
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return;

    await fetch(`/api/service-entry/${id}`, {
      method: "DELETE",
    });

    fetchEntries();
  };

  return (
    <div className="space-y-6">
      {/* 🔹 Controls */}
      <div className="flex justify-between gap-4">
        <input
          type="text"
          placeholder="Search by bike / owner / phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-4 py-2 rounded-lg w-full md:w-1/3"
        />

        <a
          href="/dashboard/service-entry/add"
          className="bg-black text-white px-4 py-2 rounded-lg"
        >
          + Add Entry
        </a>
      </div>

      {/* 🔹 Table */}
      <div className="bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-amber-50">
            <tr>
              <th className="p-3">Bike Number</th>
              <th>Owner</th>
              <th>Phone</th>
              <th>Services</th>
              <th>Total</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredEntries.map((entry) => (
              <tr key={entry._id} className="border-t">
                <td className="p-3">{entry.bikeId.bikeNumber}</td>
                <td>{entry.bikeId.ownerName}</td>
                <td>{entry.bikeId.phone}</td>

                {/* 🔹 Services List */}
                <td>
                  {entry.services.map((s) => (
                    <div key={s._id}>
                      {s.serviceId.name} (₹{s.price})
                    </div>
                  ))}
                </td>

                <td>₹{entry.total}</td>
                <td>{new Date(entry.date).toLocaleDateString()}</td>

                <td className="flex gap-2 p-3">
                  <button className="text-blue-600">
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(entry._id)}
                    className="text-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}