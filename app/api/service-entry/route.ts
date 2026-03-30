import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/dbConnect";
import ServiceEntry from "@/app/models/ServiceEntry";
import "@/app/models/Bike";
import "@/app/models/Service";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();

    const entry = await ServiceEntry.create(body);

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}

export async function GET() {
  try {
    await dbConnect();

    const data = await ServiceEntry.find()
      .populate("bikeId")
      .populate("services.serviceId")
      .sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching service entries:", error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}