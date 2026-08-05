import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { type, image, prompt } = await req.json();
    const apiKey = (process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return NextResponse.json({ error: { message: 'ไม่พบคีย์ AI บน Vercel' } }, { status: 400 });
    }

    let messages = [];
    let model = 'qwen/qwen3.6-27b';
    let extraParams = { reasoning_effort: 'none', reasoning_format: 'hidden' };

    if (type === 'scan-image') {
      model = 'qwen/qwen3.6-27b';
      extraParams = { reasoning_effort: 'none', reasoning_format: 'hidden' };
      messages = [
        {
          role: 'system',
          content: `คุณคือ AI ผู้เชี่ยวชาญอ่านฉลากสินค้าอุปโภคบริโภคภาษาไทย ตอบกลับเป็น JSON เพียงอย่างเดียว ห้ามมี markdown ห้ามมีคำอธิบายใดๆ นอกเหนือจาก JSON

โครงสร้างที่ต้องตอบ (ทุก field เป็น string):
{"name": "ชื่อสินค้าตามฉลาก", "brand": "ชื่อยี่ห้อ", "category": "หมวดหมู่กว้างๆ เช่น ของกิน ของใช้ห้องน้ำ เครื่องสำอาง", "unit": "หน่วยนับบรรจุภัณฑ์ เช่น ขวด ถุง กล่อง กระป๋อง", "size": "ขนาดสัมพัทธ์ เล็ก กลาง ใหญ่", "volume": "ปริมาณสุทธิตามฉลากตรงตัว เช่น 500ml 1kg 250g"}

กฎสำคัญ:
- ถ้าอ่านตัวอักษรในรูปไม่ชัดหรือไม่มั่นใจ ให้ใส่ "" ในช่องนั้น ห้ามเดาหรือสร้างข้อมูลขึ้นเอง
- ถ้าฉลากมีตัวเลขปริมาณหลายจุด ให้เลือกเฉพาะปริมาณสุทธิ (Net Weight/Volume) เท่านั้น
- ตอบเป็น JSON object เดียวเท่านั้น`
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
      model = 'openai/gpt-oss-120b';
      extraParams = { reasoning_effort: 'low', reasoning_format: 'hidden' };
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
    } else if (type === 'cart-command') {
      model = 'openai/gpt-oss-120b';
      extraParams = { reasoning_effort: 'low', reasoning_format: 'hidden' };
      messages = [
        {
          role: 'system',
          content: `คุณคือ AI ช่วยจดตะกร้าคำนวณเงินสดภาษาไทย ถอดเจตนาจากประโยคที่พิมพ์ขณะเดินซื้อของ ตอบเป็น JSON Array เสมอ ห้ามมีข้อความอื่นนอกจาก JSON

โครงสร้าง: [{"action": "ADD" หรือ "UPDATE", "name": "ชื่อสินค้า", "qty": จำนวนชิ้นเป็นตัวเลข, "price": ราคารวมทั้งรายการเป็นตัวเลข}]

กฎ:
- ถ้าประโยคพูดถึงการเพิ่มของใหม่ลงตะกร้า ให้ใช้ action "ADD"
- ถ้าประโยคพูดถึงการแก้ไข/เปลี่ยนราคาของที่มีอยู่แล้ว ให้ใช้ action "UPDATE"
- ประโยคเดียวอาจมีหลายรายการ ให้แตกเป็นหลาย object ใน array ได้
- qty คือจำนวนชิ้น ถ้าไม่ได้บอกจำนวน ให้ใช้ 1
- price ต้องเป็น "ราคารวม" ของรายการนั้นเสมอ (unit_price คูณ qty) เช่น "ยาหม่อง 2 ขวด ขวดละ 20 บาท" ให้ตอบ {"action":"ADD","name":"ยาหม่อง","qty":2,"price":40}
- ถ้าประโยคบอกราคารวมมาตรงๆ อยู่แล้ว (เช่น "รวมเงินเป็น 40 บาท") ให้ใช้ตัวเลขนั้นเป็น price ตรงๆ ไม่ต้องคำนวณซ้ำ
- price และ qty ต้องเป็นตัวเลขล้วน ไม่ใส่หน่วยบาทหรือหน่วยนับ`
        },
        {
          role: 'user',
          content: `ถอดเจตนาประโยคตะกร้านี้: "${prompt}"`
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
        temperature: 0.2,
        ...extraParams
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
