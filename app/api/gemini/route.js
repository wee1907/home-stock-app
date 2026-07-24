import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { type, image, prompt } = await req.json();
    const apiKey = (process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return NextResponse.json({ error: { message: 'ไม่พบคีย์ AI บน Vercel' } }, { status: 400 });
    }

    let messages = [];
    let model = 'llama-3.2-11b-vision-preview'; // โมเดลสแกนรูปภาพจาก Meta

    if (type === 'scan-image') {
      messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'อ่านฉลากสินค้านี้แล้วตอบเป็น JSON ภาษาไทยแบบนี้เท่านั้น ห้ามมีคำอื่น: {"name": "ชื่อสินค้า", "brand": "ยี่ห้อ", "category": "ห้องน้ำและทำความสะอาด หรือ ห้องครัวและของกิน หรือ เครื่องสำอาง หรือ อื่นๆ"}' },
            { type: 'image_url', image_url: { url: `data:image/webp;base64,${image}` } }
          ]
        }
      ];
    } else if (type === 'quick-command') {
      model = 'llama-3.3-70b-versatile'; // โมเดลประมวลผลข้อความภาษาไทย
      messages = [
        {
          role: 'user',
          content: `แปลประโยคนี้: "${prompt}" เป็น JSON ภาษาไทยแบบนี้เท่านั้น ห้ามมีคำอื่น: {"action": "DEDUCT" หรือ "ADD", "target_name": "ชื่อสินค้าที่ใกล้เคียง", "quantity": จำนวนเลข} หากมีคำว่า 'ใช้/หมด' ให้ action=DEDUCT หากมีคำว่า 'ซื้อ/เติม' ให้ action=ADD`
        }
      ];
    }

    // ยิงไปที่ GROQ AI (เร็วที่สุดในโลก และไม่มีปัญหาเรื่องคีย์ AQ)
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.2
      })
    });

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: { message: data.error.message } }, { status: 400 });
    }

    const contentText = data.choices?.[0]?.message?.content || '';
    return NextResponse.json({
      candidates: [{ content: { parts: [{ text: contentText }] } }]
    });
  } catch (err) {
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}
