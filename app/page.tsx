import Link from "next/link";
import { Award, Clock, Droplets, IndianRupee, MapPin, Phone, ShieldCheck, Wrench } from "lucide-react";
import dbConnect from "@/app/lib/dbConnect";
import Service from "@/app/models/Service";
import { inr } from "@/app/lib/format";

// Re-read the price list every few minutes so catalog edits show up
export const revalidate = 300;

type PublicService = { _id: string; name: string; price: number; category: string; description?: string; duration?: number };

async function getServices(): Promise<PublicService[]> {
  try {
    await dbConnect();
    const services = await Service.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
    return services.map((s) => ({ ...s, _id: String(s._id) })) as PublicService[];
  } catch {
    return [];
  }
}

const FEATURES = [
  { icon: Wrench, title: "Professional equipment", text: "Pressure washers, foam cannons and machine polishers." },
  { icon: Award, title: "Experienced team", text: "Trained detailers who treat every bike like their own." },
  { icon: IndianRupee, title: "Honest pricing", text: "Clear prices up front. No surprises on the bill." },
  { icon: ShieldCheck, title: "Premium products", text: "pH-neutral shampoos, ceramic and graphene protection." },
];

export default async function Home() {
  const services = await getServices();

  return (
    <main className="bg-white text-slate-800">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center" aria-label="Quick Shine home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Quick Shine" width={72} height={48} className="h-12 w-auto" />
          </Link>
          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
              <a href="#services" className="hover:text-brand-600">Services</a>
              <a href="#about" className="hover:text-brand-600">About</a>
              <a href="#contact" className="hover:text-brand-600">Contact</a>
            </div>
            <Link href="/login" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Staff login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-linear-to-br from-brand-600 via-brand-700 to-brand-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
            <Droplets className="size-3.5" /> Premium bike detailing studio
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">Get that showroom shine again</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/80 sm:text-lg">
            Foam wash, polishing, ceramic coating and more, done right while you wait.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#services" className="rounded-2xl bg-white px-6 py-3.5 font-semibold text-brand-700 hover:bg-brand-50">
              See services & prices
            </a>
            <a href="#contact" className="rounded-2xl border border-white/30 px-6 py-3.5 font-semibold text-white hover:bg-white/10">
              Visit us
            </a>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="scroll-mt-16 bg-slate-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">Our services</h2>
          <p className="mt-2 text-center text-slate-500">Walk in any time — most services are done within the hour.</p>
          {services.length === 0 ? (
            <p className="mt-10 text-center text-slate-500">Our price list is being updated. Please call us for details.</p>
          ) : (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <div key={service._id} className="flex flex-col rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{service.name}</h3>
                    {service.category === "premium" && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Premium</span>
                    )}
                  </div>
                  {service.description && <p className="mt-1 text-sm text-slate-500">{service.description}</p>}
                  <div className="mt-4 flex items-end justify-between pt-2">
                    <span className="text-2xl font-bold text-brand-600">{inr(service.price)}</span>
                    {service.duration ? (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="size-3.5" /> ~{service.duration} min
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-16 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">Why riders choose us</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-500">
            Quick Shine delivers professional bike detailing that improves appearance, extends lifespan and protects your ride. We combine
            modern tools, premium products and expert technique.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-100 p-5">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-brand-600 px-6 py-12 text-center text-white">
          <h2 className="text-3xl font-bold">Ready to shine your bike?</h2>
          <p className="mt-2 text-white/80">Drop by today and ride out looking brand new.</p>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-slate-900 px-4 py-10 text-slate-300 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center text-sm sm:flex-row sm:justify-between sm:text-left">
          <p className="font-semibold text-white">© {new Date().getFullYear()} Quick Shine</p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-6">
            <span className="flex items-center gap-1.5">
              <Phone className="size-4" /> +91 XXXXX XXXXX
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" /> Visit our studio
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
