import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { type, image, prompt } = await req.json();
    const apiKey = (process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return NextResponse.json({ error: { message: 'ไม่พบคีย์ Gemini API บน Vercel' } }, { status: 400 });
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

    // ตั้งค่า Header ให้รองรับรหัสแบบ AQ. (OAuth2 Bearer Token)
    const headers = { 'Content-Type': 'application/json' };

    if (apiKey.startsWith('AQ')) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      headers['x-goog-api-key'] = apiKey;
    }

    const url = apiKey.startsWith('AQ')
      ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contents })
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}
