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
          content: 'คุณคือ AI อ่านฉลากสินค้าไทย ตอบเฉพาะ JSON เท่านั้น ห้ามมีข้อความอื่น โครงสร้าง: {"name": "ชื่อสินค้าภาษาไทย", "brand": "ยี่ห้อ", "category": "ห้องน้ำและทำความสะอาด หรือ ห้องครัวและของกิน หรือ เครื่องสำอาง หรือ อื่นๆ", "unit": "ขวด หรือ ถุง หรือ ก้อน หรือ กล่อง หรือ แพ็ค", "size": "เล็ก หรือ กลาง หรือ ใหญ่ หรือ ถุงเติม"}'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'ถอดข้อมูลฉลากสินค้านี้ลง JSON:' },
            { type: 'image_url', image_url: { url: `data:image/webp;base64,${image}` } }
          ]
        }
      ];
    } else if (type === 'quick-command') {
      model = 'llama-3.3-70b-versatile'; // โมเดลใหญ่เข้าใจภาษาคนสั่งงาน
      messages = [
        {
          role: 'system',
          content: 'คุณคือ AI ถอดเจตนาการจัดการสต๊อกบ้านภาษาไทยที่ฉลาดที่สุด เข้าใจภาษาพูด คำสแลง พิมพ์ผิด หรือการสั่งหลายอย่างพร้อมกัน ให้ตอบเป็น JSON Array ของรายการที่จะทำเสมอ โครงสร้าง: [{"action": "DEDUCT" หรือ "ADD", "target_name": "ชื่อสินค้า", "brand": "ยี่ห้อถ้ามี", "size": "ขนาดถ้ามี", "quantity": จำนวนเลข}]'
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
