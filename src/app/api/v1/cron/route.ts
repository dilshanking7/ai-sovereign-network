import { NextResponse } from 'next/server';

// Yeh background loop/endpoint hai jo bina kisi human intervention ke autonomous pulse chala dega
export async function GET(request: Request) {
  try {
    // Apne hi server ke pulse endpoint ko background me trigger karna
    const baseUrl = new URL(request.url).origin;
    const pulseResponse = await fetch(`${baseUrl}/api/v1/pulse`);
    const pulseData = await pulseResponse.json();

    return NextResponse.json({
      success: true,
      message: "Autonomous background loop executed successfully.",
      pulse_result: pulseData
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
