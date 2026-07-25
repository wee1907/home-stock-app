import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { type, image, prompt } = await req.json();
    const apiKey = (process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return NextResponse.json({ error: { message: 'ไม่พบคีย์ AI บน Vercel' } }, { status: 400 });
    }

    let messages = [];
    let model = 'llama-3.2-90b-vision-preview';

    if (type === 'scan-image') {
      messages = [
        {
          role: 'system',
          content: 'คุณคือ AI อ่านฉลากสินค้าไทย ตอบเฉพาะ JSON เท่านั้น ห้ามมีข้อความอื่น โครงสร้าง: {"name": "ชื่อสินค้าภาษาไทย", "brand": "ยี่ห้อ", "category": "หมวดหมู่", "unit": "หน่วยนับ", "size": "ขนาด", "volume": "ปริมาณระบุบนซอง"}'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'สกัดข้อมูลฉลากสินค้านี้ลง JSON:' },
            { type: 'image_url', image_url: { url: `data:image/webp;base64,${image}` } }
          ]
        }
      ];
    } else if (type === 'quick-command') {
      model = 'llama-3.3-70b-versatile';
      messages = [
        {
          role: 'system',
          content: 'คุณคือ AI ถอดเจตนาการจัดการสต๊อกบ้านภาษาไทย เข้าใจคำสแลง พิมพ์ผิด สั่งเพิ่ม/ลบ/เติม/ตัด หลายอย่างพร้อมกันได้ ให้ตอบเป็น JSON Array เสมอ โครงสร้าง: [{"action": "CREATE" หรือ "DEDUCT" หรือ "ADD" หรือ "DELETE", "target_name": "ชื่อสินค้า", "brand": "ยี่ห้อถ้ามี", "size": "ขนาดถ้ามี", "quantity": จำนวนเลข, "price": ราคาเลขถ้ามี, "unit": "หน่วยนับถ้ามี"}]'
        },
        {
          role: 'user',
          content: `ถอดเจตนาประโยคสั่งงานนี้: "${prompt}"`
        }
      ];
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.1
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
