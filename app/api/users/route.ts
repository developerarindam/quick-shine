import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/dbConnect";
import User from "@/app/models/User";


export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();

    const service = await User.create(body);

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
  
    const services = await User.find();
  
    return NextResponse.json({ success: true, data: services });
  }

  export async function PUT(req: Request) {
    await dbConnect();
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
  
    const updated = await User.findByIdAndUpdate(id, body, {
      new: true,
    });
  
    return NextResponse.json({ success: true, data: updated });
  }
  
  export async function DELETE(req: Request) {
    await dbConnect();
  
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
  
    await User.findByIdAndDelete(id);
  
    return NextResponse.json({ success: true });
  }