"use client";

import React, { useEffect, useState } from "react";

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", category: "basic" });
  const [editId, setEditId] = useState<string | null>(null);

  // Fetch services
  const fetchServices = async () => {
    try {
      const res = await fetch("/api/services");
      const data = await res.json();
      setServices(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const filteredServices = services.filter((service) => {
    return (
      service.name.toLowerCase().includes(search.toLowerCase()) &&
      (categoryFilter === "All" || service.category === categoryFilter)
    );
  });

  const handleSave = async () => {
    const method = editId ? "PUT" : "POST";
    const url = editId ? `/api/services/${editId}` : "/api/services";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: Number(form.price),
      }),
    });

    setForm({ name: "", price: "", category: "basic" });
    setEditId(null);
    setIsModalOpen(false);
    fetchServices();
  };
   const handleEdit = (service: any) => {
    setForm({
      name: service.name,
      price: service.price,
      category: service.category,
    });
    setEditId(service._id);
    setIsModalOpen(true);
  };
  
  const handleDelete = async (id: string) => {
    await fetch(`/api/services/${id}`, {
      method: "DELETE",
    });
    fetchServices();
  };
  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <input
          type="text"
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-4 py-2 w-full md:w-1/3"
        />

        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="All">All Categories</option>
            <option value="basic">Basic</option>
            <option value="premium">Premium</option>
            <option value="addon">Addon</option>
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-black text-white px-4 py-2 rounded-lg"
          >
            + Add Service
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-amber-50">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Price</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.map((service) => (
              <tr key={service._id} className="border-t">
                <td className="p-3">{service.name}</td>
                <td className="p-3 capitalize">{service.category}</td>
                <td className="p-3">₹{service.price}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    service.isActive
                      ? "bg-green-100 text-green-600"
                      : "bg-red-100 text-red-600"
                  }`}>
                    {service.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => handleEdit(service)} className="text-blue-600">Edit</button>
                  <button onClick={() => handleDelete(service._id)} className="text-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">Add Service</h2>

            <input
              type="text"
              placeholder="Service Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />

            <input
              type="number"
              placeholder="Price"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />

            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
              <option value="addon">Addon</option>
            </select>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-black text-white rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
