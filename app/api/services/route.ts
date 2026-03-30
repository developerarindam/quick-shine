import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/dbConnect";
import Service from "@/app/models/Service";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();

    const service = await Service.create(body);

    return NextResponse.json({ success: true, data: service });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

export async function GET() {
    await dbConnect();
  
    const services = await Service.find({ isActive: true }).sort({ sortOrder: 1 });
  
    return NextResponse.json({ success: true, data: services });
  }

  export async function PUT(req: Request, { params }: any) {
    await dbConnect();
    const body = await req.json();
  
    const updated = await Service.findByIdAndUpdate(params.id, body, {
      new: true,
    });
  
    return NextResponse.json({ success: true, data: updated });
  }
  
  export async function DELETE(req: Request, { params }: any) {
    await dbConnect();
  
    await Service.findByIdAndDelete(params.id);
  
    return NextResponse.json({ success: true });
  }