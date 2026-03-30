"use client";

import React, { useEffect, useState } from "react";

const initialForm = {
  bikeNumber: "",
  ownerName: "",
  phone: "",
  model: "",
};

type Bike = {
  _id: string;
  bikeNumber: string;
  ownerName: string;
  phone: string;
  model: string;
};

type BikesResponse = {
  success: boolean;
  data: Bike[];
};

export default function BikesPage() {
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState<string>("");

  // 🔹 Fetch Bikes
  const fetchBikes = async () => {
    const res = await fetch("/api/bikes");
    const data: BikesResponse = await res.json();
    setBikes(data.data);
  };

  useEffect(() => {
    fetchBikes();
  }, []);

  // 🔹 Filter Logic
  const filteredBikes = bikes.filter((bike) => {
    const keyword = search.toLowerCase();

    return (
      (bike.model?.toLowerCase().includes(keyword) ||
        bike.bikeNumber?.toLowerCase().includes(keyword)) &&
      (brandFilter === "All" || bike.model === brandFilter)
    );
  });

  // 🔹 Handle Add / Update
  const handleSubmit = async () => {
    const method = editId ? "PUT" : "POST";
    const url = "/api/bikes";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({...form,id:editId}),
    });

    resetForm();
    fetchBikes();
  };

  // 🔹 Edit
  const handleEdit = (bike: Bike) => {
    setForm(bike);
    setEditId(bike._id);
    setIsModalOpen(true);
  };

  // 🔹 Delete
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this bike?")) return;

    await fetch(`/api/bikes`, {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    fetchBikes();
  };

  // 🔹 Reset
  const resetForm = () => {
    setForm(initialForm);
    setEditId("");
    setIsModalOpen(false);
  };

  // 🔹 Unique Brands for Filter
  const brands = ["All", ...new Set(bikes.map((b) => b.model))];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <input
          type="text"
          placeholder="Search bikes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-4 py-2 rounded-lg w-full md:w-1/3"
        />

        <div className="flex gap-2">
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="border px-3 py-2 rounded-lg"
          >
            {brands.map((brand, key) => (
              <option key={key} value={brand}>
                {brand}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-black text-white px-4 py-2 rounded-lg"
          >
            + Add Bike
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-amber-50">
            <tr>
              <th className="p-3">Bike Number</th>
              <th>Model</th>
              <th>Owner Name</th>
              <th>Phone</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredBikes.map((bike, k) => (
              <tr key={k} className="border-t">
                <td className="p-3">{bike.bikeNumber}</td>
                <td>{bike.model}</td>
                <td>{bike.ownerName}</td>
                <td>{bike.phone}</td>

                <td className="flex gap-2 p-3">
                  <button
                    onClick={() => handleEdit(bike)}
                    className="text-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(bike._id)}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center">
          <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-3">
            <h2 className="font-semibold text-lg">
              {editId ? "Edit Bike" : "Add Bike"}
            </h2>

            <input
              placeholder="Bike Number"
              value={form.bikeNumber}
              onChange={(e) =>
                setForm({ ...form, bikeNumber: e.target.value.toUpperCase() })
              }
              className="w-full border px-3 py-2 rounded"              
            />

            <input
              placeholder="Model"
              value={form.model}
              onChange={(e) =>
                setForm({ ...form, model: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />

            <input
              placeholder="Owner Name"
              value={form.ownerName}
              onChange={(e) =>
                setForm({ ...form, ownerName: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />

            <input
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
              placeholder="Phone"
            />
              

            <div className="flex justify-end gap-2">
              <button onClick={resetForm} className="border px-4 py-2 rounded">
                Cancel
              </button>

              <button
                onClick={handleSubmit}
                className="bg-black text-white px-4 py-2 rounded"
              >
                {editId ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}