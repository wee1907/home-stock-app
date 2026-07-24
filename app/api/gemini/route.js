import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { type, image, prompt } = await req.json();
    const apiKey = (process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return NextResponse.json({ error: { message: 'ไม่พบคีย์ Gemini API บนระบบ' } }, { status: 400 });
    }

    let contents = [];

    if (type === 'scan-image') {
      contents = [{
        parts: [
          { text: 'อ่านฉลากสินค้านี้แล้วตอบเป็น JSON ภาษาไทยแบบนี้เท่านั้น: {"name": "ชื่อสินค้า", "brand": "ยี่ห้อ", "category": "ห้องน้ำและทำความสะอาด หรือ ห้องครัวและของกิน หรือ เครื่องสำอาง หรือ อื่นๆ"}' },
          { inline_data: { mime_type: 'image/webp', data: image } }
        ]
      }];
    } else if (type === 'quick-command') {
      contents = [{
        parts: [{ text: `แปลประโยคนี้: "${prompt}" เป็น JSON สั้นๆ: {"action": "DEDUCT" หรือ "ADD", "target_name": "ชื่อสินค้าที่ใกล้เคียง", "quantity": จำนวนเลข} หากมีคำว่า 'ใช้/หมด' ให้ action=DEDUCT หากมีคำว่า 'ซื้อ/เติม' ให้ action=ADD` }]
      }];
    }

    // ยิงแบบ Server-to-Server Bypasses Browser CORS
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({ contents })
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}
