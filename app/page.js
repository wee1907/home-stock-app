'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Minus, Search, Camera, AlertTriangle, CheckCircle, Package, RefreshCw, Trash2, Volume2 } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

const CATEGORIES = ['ทั้งหมด', 'ห้องน้ำและทำความสะอาด', 'ห้องครัวและของกิน', 'เครื่องสำอาง', 'อื่นๆ'];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [quickCmd, setQuickCmd] = useState('');
  const [cmdProcessing, setCmdProcessing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: 'ห้องน้ำและทำความสะอาด',
    quantity: 1,
    min_threshold: 1,
    image_url: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (!error) setProducts(data || []);
    setLoading(false);
  };

  // ย่อขนาดรูปภาพให้เหลือไฟล์เล็กมากๆ (<50KB) เพื่อประหยัดพื้นที่
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const scaleFactor = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleFactor;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/webp', 0.6));
        };
      };
    });
  };

  // สแกนรูปด้วย AI (Gemini 1.5 Flash)
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAiProcessing(true);
    try {
      const base64Image = await compressImage(file);
      setFormData((prev) => ({ ...prev, image_url: base64Image }));

      // ส่งรูปให้ Gemini ช่วยอ่านฉลาก
      const pureBase64 = base64Image.split(',')[1];
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'อ่านฉลากสินค้านี้แล้วตอบเป็น JSON สั้นๆ ดังนี้: {"name": "ชื่อสินค้าภาษาไทย", "brand": "ยี่ห้อ", "category": "เลือกจาก [ห้องน้ำและทำความสะอาด, ห้องครัวและของกิน, เครื่องสำอาง, อื่นๆ]"}' },
              { inline_data: { mime_type: 'image/webp', data: pureBase64 } }
            ]
          }]
        })
      });

      const aiData = await res.json();
      const textResponse = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setFormData((prev) => ({
          ...prev,
          name: parsed.name || prev.name,
          brand: parsed.brand || prev.brand,
          category: CATEGORIES.includes(parsed.category) ? parsed.category : prev.category,
        }));
      }
    } catch (err) {
      console.error('AI Scan Error:', err);
    } finally {
      setAiProcessing(false);
    }
  };

  // พิมพ์/พูด สั่งงานด่วน เช่น "ใช้น้ำยาล้างจาน 1 ถุง"
  const handleQuickCommand = async (e) => {
    e.preventDefault();
    if (!quickCmd.trim()) return;

    setCmdProcessing(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `แปลประโยคสั่งงานนี้: "${quickCmd}" เป็น JSON ดังนี้: {"action": "DEDUCT" หรือ "ADD", "target_name": "ชื่อสินค้าที่ใกล้เคียง", "quantity": จำนวนเลข} หากบอก 'ใช้' ให้ action=DEDUCT หากบอก 'ซื้อ/เติม' ให้ action=ADD` }]
          }]
        })
      });

      const aiData = await res.json();
      const textResponse = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const matchedProduct = products.find((p) => p.name.includes(parsed.target_name) || parsed.target_name.includes(p.name));

        if (matchedProduct) {
          const change = parsed.action === 'DEDUCT' ? -Math.abs(parsed.quantity || 1) : Math.abs(parsed.quantity || 1);
          await updateQuantity(matchedProduct.id, matchedProduct.quantity + change);
          alert(`✅ ${parsed.action === 'DEDUCT' ? 'ตัดสต๊อก' : 'เติมสต๊อก'} "${matchedProduct.name}" จำนวน ${Math.abs(change)} เรียบร้อย!`);
          setQuickCmd('');
        } else {
          alert(`❌ ไม่พบสินค้าชื่อ "${parsed.target_name}" ในสต๊อก`);
        }
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการประมวลผลคำสั่ง');
    } finally {
      setCmdProcessing(false);
    }
  };

  // เพิ่ม/ลด จำนวนสินค้า
  const updateQuantity = async (id, newQty) => {
    const finalQty = Math.max(0, newQty);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, quantity: finalQty } : p)));
    await supabase.from('products').update({ quantity: finalQty, dont_remind: false }).eq('id', id);
  };

  // ซ่อนการแจ้งเตือน
  const dismissAlert = async (id) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, dont_remind: true } : p)));
    await supabase.from('products').update({ dont_remind: true }).eq('id', id);
  };

  // บันทึกสินค้าใหม่
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.from('products').insert([formData]).select();
    if (!error && data) {
      setProducts([data[0], ...products]);
      setShowAddModal(false);
      setFormData({ name: '', brand: '', category: 'ห้องน้ำและทำความสะอาด', quantity: 1, min_threshold: 1, image_url: '' });
    }
  };

  // กรองสินค้าตามแท็บ
  const filteredProducts = products.filter((p) => {
    const matchesTab = activeTab === 'ทั้งหมด' ? true : activeTab === 'ใกล้หมด' ? p.quantity <= p.min_threshold : p.category === activeTab;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const lowStockItems = products.filter((p) => p.quantity <= p.min_threshold && !p.dont_remind);

  return (
    <div className="max-w-md md:max-w-3xl mx-auto px-4 pt-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🏡 Home Stock</h1>
          <p className="text-sm text-slate-500">จัดการของใช้ในบ้าน สะดวก รวดเร็ว</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 text-sm transition">
          <Plus size={18} /> เพิ่มของเข้าบ้าน
        </button>
      </div>

      {/* Quick Command Box (พิมพ์/พูด สั่งตัดสต๊อก) */}
      <form onSubmit={handleQuickCommand} className="mb-6">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="💬 พิมพ์สั่งด่วน เช่น 'ใช้น้ำยาล้างจาน 1 ถุง'..."
            value={quickCmd}
            onChange={(e) => setQuickCmd(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-4 pr-24 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button type="submit" disabled={cmdProcessing} className="absolute right-1.5 bg-slate-800 text-white text-xs font-medium px-3.5 py-2 rounded-xl">
            {cmdProcessing ? 'กำลังส่ง...' : 'สั่งงาน'}
          </button>
        </div>
      </form>

      {/* Low Stock Alert Box */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-2 text-amber-800 font-semibold mb-2 text-sm">
            <AlertTriangle size={18} /> สินค้าใกล้หมดสต๊อก ({lowStockItems.length} รายการ)
          </div>
          <div className="space-y-2">
            {lowStockItems.map((item) => (
              <div key={item.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-amber-100 text-xs">
                <span className="font-medium text-slate-700">{item.brand ? `[${item.brand}] ` : ''}{item.name} (เหลือ {item.quantity})</span>
                <button onClick={() => dismissAlert(item.id)} className="text-slate-400 hover:text-slate-600 text-xs underline">
                  ไม่ต้องเตือนอีก
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Categories */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="ค้นหาชื่อสินค้า หรือยี่ห้อ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition ${activeTab === cat ? 'bg-emerald-600 text-white font-medium shadow-sm' : 'bg-white border border-slate-200 text-slate-600'}`}
            >
              {cat}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('ใกล้หมด')}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition ${activeTab === 'ใกล้หมด' ? 'bg-amber-500 text-white font-medium shadow-sm' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}
          >
            ⚠️ ใกล้หมด
          </button>
        </div>
      </div>

      {/* Product List Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">กำลังโหลดข้อมูลสต๊อก...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">ไม่พบรายการสินค้า</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredProducts.map((item) => (
            <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-3.5 flex gap-3 items-center shadow-sm relative">
              {/* Product Image */}
              <div className="w-16 h-16 bg-slate-100 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center border border-slate-100">
                {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <Package className="text-slate-300" size={24} />}
              </div>

              {/* Product Info */}
              <div className="flex-grow min-w-0">
                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mb-1">{item.category}</span>
                <h3 className="font-semibold text-slate-800 text-sm truncate">{item.name}</h3>
                <p className="text-xs text-slate-400 truncate">{item.brand || 'ไม่ระบุยี่ห้อ'}</p>
              </div>

              {/* Quantity Controls */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 hover:bg-white rounded-md text-slate-600">
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-slate-700">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 hover:bg-white rounded-md text-slate-600">
                    <Plus size={14} />
                  </button>
                </div>
                {item.quantity <= item.min_threshold && <span className="text-[9px] text-amber-600 font-medium">ใกล้หมด</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-800">📸 บันทึกของเข้าบ้าน</h2>

            {/* AI Photo Scan Button */}
            <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/50 rounded-2xl p-4 text-center cursor-pointer relative">
              <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              <Camera className="mx-auto text-emerald-600 mb-1" size={28} />
              <span className="text-xs font-medium text-emerald-700 block">{aiProcessing ? '⚡ AI กำลังสแกนรูปภาพ...' : 'ถ่ายรูปหน้าซอง/ขวด (ให้ AI อ่านให้อัตโนมัติ)'}</span>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-600 mb-1">ชื่อสินค้า</label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500" placeholder="เช่น น้ำยาล้างจาน" />
              </div>

              <div>
                <label className="block font-medium text-slate-600 mb-1">ยี่ห้อ</label>
                <input type="text" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500" placeholder="เช่น Sunlight" />
              </div>

              <div>
                <label className="block font-medium text-slate-600 mb-1">หมวดหมู่</label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full border rounded-xl p-2.5">
                  {CATEGORIES.filter((c) => c !== 'ทั้งหมด').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-600 mb-1">จำนวนที่ซื้อมา</label>
                  <input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })} className="w-full border rounded-xl p-2.5" />
                </div>
                <div>
                  <label className="block font-medium text-slate-600 mb-1">เตือนเมื่อเหลือต่ำกว่า</label>
                  <input type="number" min="1" value={formData.min_threshold} onChange={(e) => setFormData({ ...formData, min_threshold: parseInt(e.target.value) || 1 })} className="w-full border rounded-xl p-2.5" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="w-1/2 bg-slate-100 py-2.5 rounded-xl text-slate-600 font-medium">ยกเลิก</button>
                <button type="submit" className="w-1/2 bg-emerald-600 text-white py-2.5 rounded-xl font-medium">บันทึกสต๊อก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
