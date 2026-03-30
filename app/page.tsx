import Link from "next/link";

export default function Home() {
  return (
    <main className="bg-gray-50 text-gray-800">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white shadow">
        <h1 className="text-2xl font-bold text-blue-600">Quick Shine</h1>
        <div className="space-x-6">
          <a href="#services" className="hover:text-blue-500">Services</a>
          <a href="#about" className="hover:text-blue-500">About</a>
          <a href="#contact" className="hover:text-blue-500">Contact</a>
          <Link href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700">
            Login
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="text-center py-20 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
        <h2 className="text-4xl font-bold mb-4">Get Showroom Shine Again!</h2>
        <p className="text-lg mb-6">Premium Bike Detailing & Protection Services</p>
        <Link href="/login" className="bg-white text-blue-600 px-6 py-3 rounded-2xl font-semibold hover:bg-gray-200">
          Book Now
        </Link>
      </section>

      {/* Services Section */}
      <section id="services" className="py-16 px-6">
        <h3 className="text-3xl font-bold text-center mb-10">Our Services</h3>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Machine Polish",
              desc: "3-step polishing process to restore shine and remove scratches",
            },
            {
              title: "Teflon Coating",
              desc: "Long-lasting protection against dust, UV & water",
            },
            {
              title: "Full Bike Detailing",
              desc: "Complete deep cleaning and restoration for your bike",
            },
          ].map((service, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition">
              <h4 className="text-xl font-semibold mb-2">{service.title}</h4>
              <p className="text-gray-600">{service.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-gray-100 py-16 px-6 text-center">
        <h3 className="text-3xl font-bold mb-6">What We Do</h3>
        <p className="max-w-2xl mx-auto text-gray-600">
          Quick Shine delivers professional bike detailing solutions designed to enhance appearance,
          increase lifespan, and protect your vehicle. We combine modern tools, premium products,
          and expert techniques to deliver outstanding results.
        </p>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6">
        <h3 className="text-3xl font-bold text-center mb-10">Why Choose Us</h3>
        <div className="grid md:grid-cols-4 gap-6 text-center">
          {[
            "Professional Equipment",
            "Experienced Team",
            "Affordable Pricing",
            "Customer Satisfaction",
          ].map((item, i) => (
            <div key={i} className="bg-white p-5 rounded-xl shadow">
              <p className="font-medium">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white text-center py-16">
        <h3 className="text-3xl font-bold mb-4">Ready to Shine Your Bike?</h3>
        <p className="mb-6">Book your service now and experience the difference</p>
        <Link href="/login" className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200">
          Get Started
        </Link>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-white py-10 text-center">
        <p className="mb-2">© {new Date().getFullYear()} Quick Shine</p>
        <p>Contact: +91 XXXXX XXXXX</p>
      </footer>
    </main>
  );
}
