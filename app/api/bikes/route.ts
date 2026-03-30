// app/api/bikes/route.ts
import { NextResponse } from "next/server";
import connectDB from "@/app/lib/dbConnect";
import Bike from "@/app/models/Bike";

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();

    const bike = await Bike.create(body);

    return NextResponse.json({ success: true, data: bike });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  await connectDB();
  const bikes = await Bike.find().sort({ createdAt: -1 });

  return NextResponse.json({ success: true, data: bikes });
}

export async function PUT(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const { id, ...updateData } = body;

    const bike = await Bike.findByIdAndUpdate(id, updateData, { new: true });

    if (!bike) {
      return NextResponse.json(
        { success: false, message: "Bike not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: bike });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const { id } = body;

    const bike = await Bike.findByIdAndDelete(id);

    if (!bike) {
      return NextResponse.json(
        { success: false, message: "Bike not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Bike deleted" });
  } catch (error: any) { 
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
