import { Home, Users,  Bubbles, Bike } from "lucide-react";
import Link from "next/link";

const menuItems = [
  { name: "Dashboard", icon: Home, path: "/dashboard" },
  { name: "Users", icon: Users, path: "/dashboard/users" },
  { name: "Bikes", icon: Bike, path: "/dashboard/bikes" },
  { name: "Service Entry", icon: Bike, path: "/dashboard/bikes-entry" },
  { name: "Services", icon: Bubbles, path: "/dashboard/services" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const handleLogout = async () => {
    await fetch("/api/logout", {
      method: "POST",
    });
  
    // Optional: redirect
    window.location.href = "/login";
  };
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md">
        <div className="p-4 text-xl font-bold border-b">My Dashboard</div>
        <nav className="p-4 space-y-2">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <a
                key={index}
                href={item.path}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition"
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </a>
            );
          })}
          {/* //make a logout button at the end of the sidebar */}
          <Link
            href="/logout"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition text-red-600"
          >
            <span>Logout</span>
          </Link>
          
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow p-4 flex justify-between items-center">
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm">Welcome, Admin</span>
            <div className="w-8 h-8 bg-gray-300 rounded-full" />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children }
        </main>
      </div>
    </div>
  );
}
