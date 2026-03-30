"use client";

import React, { useEffect, useState } from "react";

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "USER",
  status: "Active",
};
type User = {
  _id: string;
  name: string;
  email: string;
  password?: string;
  role: "ADMIN" | "USER";
  status: "Active" | "Inactive";
};
type UsersResponse = {
  success: boolean;
  data: User[];
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState<String>("");

  // 🔹 Fetch Users
  const fetchUsers = async () => {
    const res = await fetch("/api/users");
    const data: UsersResponse = await res.json();
    setUsers(data.data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 🔹 Filter Logic (Optimized)
  const filteredUsers = users.filter((user) => {
    const keyword = search.toLowerCase();

    return (
      (user.name?.toLowerCase().includes(keyword) ||
        user.email?.toLowerCase().includes(keyword)) &&
      (roleFilter === "All" || user.role === roleFilter)
    );
  });

  // 🔹 Handle Add / Update
  const handleSubmit = async () => {
    const method = editId ? "PUT" : "POST";
    const url = editId ? `/api/users?id=${editId}` : "/api/users";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    resetForm();
    fetchUsers();
  };

  // 🔹 Edit
  const handleEdit = (user:User) => {
    setForm({ ...user, password: "" });
    setEditId(user._id);
    setIsModalOpen(true);
  };

  // 🔹 Delete
  const handleDelete = async (id:String) => {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/users?id=${id}`, {
      method: "DELETE",
    });

    fetchUsers();
  };

  // 🔹 Reset
  const resetForm = () => {
    setForm(initialForm);
    setEditId('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-4 py-2 rounded-lg w-full md:w-1/3"
        />

        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border px-3 py-2 rounded-lg"
          >
            <option value="All">All</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">User</option>
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-black text-white px-4 py-2 rounded-lg"
          >
            + Add User
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-amber-50">
            <tr>
              <th className="p-3">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user._id} className="border-t">
                <td className="p-3">{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>

                <td className="flex gap-2 p-3">
                  <button onClick={() => handleEdit(user)} className="text-blue-600">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(user._id)} className="text-red-600">
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
              {editId ? "Edit User" : "Add User"}
            </h2>

            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border px-3 py-2 rounded"
            />

            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border px-3 py-2 rounded"
            />

            <input
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border px-3 py-2 rounded"
            />

            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full border px-3 py-2 rounded"
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>

            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full border px-3 py-2 rounded"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <div className="flex justify-end gap-2">
              <button onClick={resetForm} className="border px-4 py-2 rounded">
                Cancel
              </button>

              <button onClick={handleSubmit} className="bg-black text-white px-4 py-2 rounded">
                {editId ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}