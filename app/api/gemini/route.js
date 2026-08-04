import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { type, image, prompt } = await req.json();
    const apiKey = (process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return NextResponse.json({ error: 'ไม่พบคีย์ AI บน Vercel' }, { status: 200 });
    }

    let messages = [];
    let model = 'llama-3.2-11b-vision-instruct';

    if (type === 'scan-image') {
      // สำหรับสแกนรูปภาพ รวมข้อความสั่งการเข้าไปใน role: user โดยตรง (ป้องกัน Error 400)
      const formattedImage = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
      messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'คุณคือ AI อ่านฉลากสินค้า อ่านฉลากสินค้านี้แล้วตอบเป็น JSON ภาษาไทยแบบนี้เท่านั้น ห้ามมี markdown หรือข้อความอื่นเด็ดขาด: {"name": "ชื่อสินค้า", "brand": "ยี่ห้อ", "category": "ห้องครัวและของกิน หรือ ห้องน้ำและทำความสะอาด หรือ เครื่องสำอาง หรือ อื่นๆ", "unit": "ขวด หรือ ถุง หรือ ก้อน หรือ กล่อง หรือ แพ็ค หรือ ชิ้น", "size": "เล็ก หรือ กลาง หรือ ใหญ่ หรือ ถุงเติม", "volume": "ปริมาณระบุบนซอง"}'
            },
            {
              type: 'image_url',
              image_url: { url: formattedImage }
            }
          ]
        }
      ];
    } else if (type === 'quick-command') {
      model = 'llama-3.3-70b-versatile';
      messages = [
        {
          role: 'system',
          content: 'คุณคือ AI ถอดเจตนาการจัดการสต๊อกบ้านภาษาไทย ตอบเฉพาะ JSON Array เสมอ โครงสร้าง: [{"action": "CREATE" หรือ "DEDUCT" หรือ "ADD" หรือ "DELETE", "target_name": "ชื่อสินค้า", "brand": "ยี่ห้อถ้ามี", "size": "ขนาดถ้ามี", "quantity": จำนวนเลข, "price": ราคาเลขถ้ามี, "unit": "หน่วยนับถ้ามี"}]'
        },
        {
          role: 'user',
          content: `ถอดเจตนาประโยคสั่งงานนี้: "${prompt}"`
        }
      ];
    } else if (type === 'cart-command') {
      model = 'llama-3.3-70b-versatile';
      messages = [
        {
          role: 'system',
          content: 'คุณคือ AI ตะกร้าสินค้า ตอบเฉพาะ JSON Array เสมอ โครงสร้าง: [{"action": "ADD" หรือ "UPDATE", "name": "ชื่อสินค้า", "price": ราคาเลข}]'
        },
        {
          role: 'user',
          content: `ถอดเจตนาประโยคใส่ตะกร้านี้: "${prompt}"`
        }
      ];
    }

    let res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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

    let data = await res.json();

    // สำรอง: หากโมเดลแรกมีปัญหา ให้ลองสำรองด้วยโมเดล 90b
    if (data.error && type === 'scan-image') {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.2-90b-vision-preview',
          messages: messages,
          temperature: 0.1
        })
      });
      data = await res.json();
    }

    if (data.error) {
      return NextResponse.json({ error: data.error.message || 'เกิดข้อผิดพลาดจาก AI' }, { status: 200 });
    }

    const contentText = data.choices?.[0]?.message?.content || '';
    return NextResponse.json({
      candidates: [{ content: { parts: [{ text: contentText }] } }]
    }, { status: 200 });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 200 });
  }
}
