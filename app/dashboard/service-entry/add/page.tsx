"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Service {
  _id: string;
  name: string;
  price: number;
}

interface Bike {
  _id: string;
  bikeNumber: string;
  createdAt: string;
  model: string;
  ownerName: string;
  phone: string;
  updatedAt: string;
}

export default function AddServiceEntry() {
  const router = useRouter();

  const [bikes, setBikes] = useState<Bike[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);

  const [search, setSearch] = useState<string>("");
  const [filteredBikes, setFilteredBikes] = useState<Bike[]>([]);

  const [form, setForm] = useState({
    bikeId: "",
    services: [] as { serviceId: string; price: number }[],
    subtotal: 0,
    discount: 0,
    discountType: "flat",
    total: 0,
  });

  // 🚀 Fetch Data
  useEffect(() => {
    fetchBikes();
    fetchServices();
  }, []);

  const fetchBikes = async () => {
    const res = await fetch("/api/bikes");
    const data = await res.json();
    setBikes(data.data);
    setFilteredBikes(data.data);
  };

  const fetchServices = async () => {
    const res = await fetch("/api/services");
    const data = await res.json();
    setServicesList(data.data);
  };

  // 🔍 Bike Search
  const handleSearch = (value: string) => {
    setSearch(value);

    const filtered = bikes.filter((bike) =>
      bike.bikeNumber.toLowerCase().includes(value.toLowerCase())
    );

    setFilteredBikes(filtered);
  };

  const selectBike = (bike: Bike) => {
    setForm((prev) => ({ ...prev, bikeId: bike._id }));
    setSearch(bike.bikeNumber);
    setFilteredBikes([]);
  };

  // 💰 Core Calculation Engine
  const updateTotals = (
    services: { serviceId: string; price: number }[],
    discount: number,
    discountType: string
  ) => {
    const subtotal = services.reduce((acc, item) => acc + item.price, 0);

    let total = subtotal;

    if (discountType === "percent") {
      total = subtotal - (subtotal * discount) / 100;
    } else {
      total = subtotal - discount;
    }

    // Prevent negative totals
    total = Math.max(0, total);

    setForm((prev) => ({
      ...prev,
      services,
      subtotal,
      discount,
      discountType,
      total,
    }));
  };

  // ✅ Service Toggle
  const toggleService = (service: Service) => {
    const exists = form.services.find(
      (s) => s.serviceId === service._id
    );

    let updatedServices;

    if (exists) {
      updatedServices = form.services.filter(
        (s) => s.serviceId !== service._id
      );
    } else {
      updatedServices = [
        ...form.services,
        { serviceId: service._id, price: service.price },
      ];
    }

    updateTotals(
      updatedServices,
      form.discount,
      form.discountType
    );
  };

  // 🔄 Discount Handling
  const handleChange = (e: any) => {
    const { name, value } = e.target;

    const updatedDiscount =
      name === "discount" ? parseFloat(value) || 0 : form.discount;

    const updatedDiscountType =
      name === "discountType" ? value : form.discountType;

    updateTotals(
      form.services,
      updatedDiscount,
      updatedDiscountType
    );
  };

  // 🚀 Submit
  const handleSubmit = async (e: any) => {
    e.preventDefault();

    await fetch("/api/service-entry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    router.push("/dashboard/service-entry");
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-md rounded-md">
      <h2 className="text-2xl font-bold mb-4">Add Service Entry</h2>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 🔍 Bike Search */}
        <div>
          <input
            value={search}
            type="text"
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search Bike..."
            className="w-full p-2 border rounded-md"
          />

          {filteredBikes.length > 0 && (
            <div className="border mt-1 max-h-40 overflow-y-auto bg-white">
              {filteredBikes.map((bike) => (
                <div
                  key={bike._id}
                  onClick={() => selectBike(bike)}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                >
                  {bike.bikeNumber}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ✅ Services */}
        <div>
          <h4 className="font-semibold">Select Services</h4>

          {servicesList.map((service) => {
            const checked = form.services.some(
              (s) => s.serviceId === service._id
            );

            return (
              <div key={service._id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleService(service)}
                />
                <span>
                  {service.name} - ₹{service.price}
                </span>
              </div>
            );
          })}
        </div>

        {/* Discount */}
        <input
          type="number"
          name="discount"
          placeholder="Discount"
          value={form.discount}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
        />

        <select
          name="discountType"
          value={form.discountType}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
        >
          <option value="flat">Flat</option>
          <option value="percent">Percent</option>
        </select>

        {/* 💰 Summary */}
        <div className="bg-gray-100 p-4 rounded-md">
          <p>Subtotal: ₹{form.subtotal}</p>
          <p>Discount: ₹{form.discount} ({form.discountType})</p>
          <p className="font-bold text-lg">Total: ₹{form.total}</p>
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 bg-indigo-500 text-white rounded-md"
        >
          Submit
        </button>
      </form>
    </div>
  );
}