import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { type, image, prompt } = await req.json();
    const apiKey = (process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return NextResponse.json({
        candidates: [{ content: { parts: [{ text: '{"name": "สินค้าใหม่", "brand": "", "category": "อื่นๆ", "unit": "ชิ้น", "size": "กลาง"}' }] } }]
      }, { status: 200 });
    }

    // รายชื่อโมเดล Vision สำหรับสแกนรูปภาพ (เรียงลำดับลองสำรองอัตโนมัติ)
    const visionModels = [
      'meta-llama/llama-3.2-11b-vision-instruct',
      'llama-3.2-11b-vision-instruct',
      'openrouter/free',
      'google/gemini-2.0-flash-lite-001:free'
    ];

    let endpoint = apiKey.startsWith('sk-or-') 
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.groq.com/openai/v1/chat/completions';

    let headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    if (apiKey.startsWith('sk-or-')) {
      headers['HTTP-Referer'] = 'https://home-stock-app.vercel.app';
      headers['X-Title'] = 'Home Stock App';
    }

    if (type === 'scan-image') {
      const formattedImage = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
      const visionPrompt = 'คุณคือ AI อ่านฉลากสินค้า ตอบเฉพาะ JSON ภาษาไทยแบบนี้เท่านั้น ห้ามมี markdown: {"name": "ชื่อสินค้า", "brand": "ยี่ห้อ", "category": "ห้องครัวและของกิน หรือ ห้องน้ำและทำความสะอาด หรือ เครื่องสำอาง หรือ อื่นๆ", "unit": "ขวด หรือ ถุง หรือ ก้อน หรือ กล่อง หรือ แพ็ค หรือ ชิ้น", "size": "เล็ก หรือ กลาง หรือ ใหญ่ หรือ ถุงเติม", "volume": "ปริมาณระบุบนซอง"}';
      
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: visionPrompt },
            { type: 'image_url', image_url: { url: formattedImage } }
          ]
        }
      ];

      // ลองยิงทีละโมเดลในวิชั่น จนกว่าจะสำเร็จ
      for (const m of visionModels) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ model: m, messages, temperature: 0.1 })
          });
          const data = await res.json();
          if (data.choices?.[0]?.message?.content) {
            return NextResponse.json({
              candidates: [{ content: { parts: [{ text: data.choices[0].message.content }] } }]
            }, { status: 200 });
          }
        } catch (e) {
          console.log(`Model ${m} failed, trying next...`);
        }
      }

      // หากค่ายสแกนรูปติดขัดทั้งหมด ให้คืนค่าข้อมูลเริ่มต้นกลับไปอย่างนุ่มนวล โดยไม่ขึ้น Error Popup
      return NextResponse.json({
        candidates: [{ content: { parts: [{ text: '{"name": "สินค้าใหม่ (ถ่ายรูปแล้ว)", "brand": "", "category": "อื่นๆ", "unit": "ชิ้น", "size": "กลาง"}' }] } }]
      }, { status: 200 });

    } else if (type === 'quick-command' || type === 'cart-command') {
      const isQuick = type === 'quick-command';
      const textModel = apiKey.startsWith('sk-or-') ? 'openai/gpt-oss-120b' : 'llama-3.3-70b-versatile';
      const systemPrompt = isQuick 
        ? 'คุณคือ AI ถอดเจตนาการจัดการสต๊อกบ้านภาษาไทย ตอบเฉพาะ JSON Array เสมอ โครงสร้าง: [{"action": "CREATE" หรือ "DEDUCT" หรือ "ADD" หรือ "DELETE", "target_name": "ชื่อสินค้า", "brand": "ยี่ห้อถ้ามี", "size": "ขนาดถ้ามี", "quantity": จำนวนเลข, "price": ราคาเลขถ้ามี, "unit": "หน่วยนับถ้ามี"}]'
        : 'คุณคือ AI ตะกร้าสินค้า ตอบเฉพาะ JSON Array เสมอ โครงสร้าง: [{"action": "ADD" หรือ "UPDATE", "name": "ชื่อสินค้า", "price": ราคาเลข}]';

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: textModel, messages, temperature: 0.1 })
      });

      const data = await res.json();
      const contentText = data.choices?.[0]?.message?.content || '[]';
      return NextResponse.json({
        candidates: [{ content: { parts: [{ text: contentText }] } }]
      }, { status: 200 });
    }

  } catch (err) {
    return NextResponse.json({
      candidates: [{ content: { parts: [{ text: '{"name": "สินค้าใหม่", "category": "อื่นๆ"}' }] } }]
    }, { status: 200 });
  }
}
