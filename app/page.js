'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Plus, Minus, Search, Camera, AlertTriangle, Package, Trash2, X, Eye, Sparkles, Edit3, 
  Pin, Settings, Sun, Moon, FileSpreadsheet, FileText, ShoppingCart, RotateCcw, Home as HomeIcon, Tag, Clock
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

const DEFAULT_CATEGORIES = ['ทั้งหมด', 'ห้องครัวและของกิน', 'ห้องน้ำและทำความสะอาด', 'เครื่องสำอาง', 'อื่นๆ'];
const DEFAULT_UNITS = ['ขวด', 'ถุง', 'ก้อน', 'กล่อง', 'กระป๋อง', 'แพ็ค', 'ชิ้น', 'ซอง', 'เส้น'];
const DEFAULT_SIZES = ['เล็ก', 'กลาง', 'ใหญ่', 'ถุงเติม', 'ขวดใหญ่', 'จัมโบ้', '2 เมตร'];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [trashItems, setTrashItems] = useState([]);
  const [mainTab, setMainTab] = useState('stock');
  const [priceSubTab, setPriceSubTab] = useState('system');
  const [activeCategory, setActiveCategory] = useState('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [quickCmd, setQuickCmd] = useState('');
  const [cmdProcessing, setCmdProcessing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  // Custom Options State
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [units, setUnits] = useState(DEFAULT_UNITS);
  const [sizes, setSizes] = useState(DEFAULT_SIZES);
  const [newOptionInput, setNewOptionInput] = useState({ type: 'category', value: '' });

  // Temporary Basket State
  const [cartItems, setCartItems] = useState([]);
  const [cartName, setCartName] = useState('');
  const [cartPrice, setCartPrice] = useState('');

  // Temporary Price Compare Calculator State
  const [tempCalc, setTempCalc] = useState({ p1: '', v1: '', p2: '', v2: '' });

  // Form State
  const [formData, setFormData] = useState({
    name: '', brand: '', category: 'ห้องครัวและของกิน', unit: 'ถุง', size: 'กลาง',
    volume: '', quantity: 1, min_threshold: 1, price: 0, store: '', image_url: ''
  });

  useEffect(() => {
    fetchProducts();
    fetchLogs();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (data) {
      setProducts(data.filter(p => !p.deleted_at));
      setTrashItems(data.filter(p => p.deleted_at));
    }
    setLoading(false);
  };

  const fetchLogs = async () => {
    const { data } = await supabase.from('usage_logs').select('*').order('created_at', { ascending: false }).limit(500);
    if (data) setLogs(data);
  };

  // บันทึกประวัติ + ลิมิตไม่เกิน 500 รายการ (ข้อ 6)
  const logAction = async (productId, productName, actionType, qtyChanged) => {
    await supabase.from('usage_logs').insert([{
      product_id: productId,
      action_type: actionType,
      quantity_changed: qtyChanged,
      created_at: new Date().toISOString()
    }]);

    // เช็กหากประวัติเกิน 500 ให้ลบอันเก่าที่สุดทิ้ง
    const { data: allLogs } = await supabase.from('usage_logs').select('id').order('created_at', { ascending: true });
    if (allLogs && allLogs.length > 500) {
      const excessCount = allLogs.length - 500;
      const idsToDelete = allLogs.slice(0, excessCount).map(l => l.id);
      await supabase.from('usage_logs').delete().in('id', idsToDelete);
    }
    fetchLogs();
  };

  const deleteSingleLog = async (id) => {
    await supabase.from('usage_logs').delete().eq('id', id);
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  const clearAllLogs = async () => {
    if (confirm('คุณต้องการล้างประวัติการใช้งานทั้งหมดใช่ไหม?')) {
      await supabase.from('usage_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      setLogs([]);
      alert('🧹 ล้างประวัติทั้งหมดเรียบร้อยแล้ว');
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 500;
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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAiProcessing(true);
    try {
      const base64Image = await compressImage(file);
      setImagePreview(base64Image);
      setFormData((prev) => ({ ...prev, image_url: base64Image }));

      const pureBase64 = base64Image.split(',')[1];
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'scan-image', image: pureBase64 })
      });

      const aiData = await res.json();
      if (!aiData.error) {
        const textResponse = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanJsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = cleanJsonStr.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setFormData((prev) => ({
            ...prev,
            name: parsed.name || prev.name,
            brand: parsed.brand || prev.brand,
            category: categories.includes(parsed.category) ? parsed.category : 'อื่นๆ',
            unit: units.includes(parsed.unit) ? parsed.unit : prev.unit,
            size: sizes.includes(parsed.size) ? parsed.size : prev.size,
            volume: parsed.volume || prev.volume
          }));
        }
      }
    } catch (err) {
      console.log('Silent Scan Fallback');
    } finally {
      setAiProcessing(false);
    }
  };

  const handleQuickCommand = async (e) => {
    e.preventDefault();
    if (!quickCmd.trim()) return;

    setCmdProcessing(true);
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'quick-command', prompt: quickCmd })
      });

      const aiData = await res.json();
      if (aiData.error) {
        alert(`⚠️ AI สั่งงานไม่สำเร็จ (${aiData.error.message})`);
        return;
      }

      const textResponse = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleanJsonStr.match(/\[[\s\S]*\]/) || cleanJsonStr.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        let commands = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(commands)) commands = [commands];

        let msg = [];
        for (const cmd of commands) {
          if (cmd.action === 'CREATE') {
            const newItem = {
              name: cmd.target_name || 'สินค้าใหม่',
              brand: cmd.brand || '',
              category: 'อื่นๆ',
              size: cmd.size || 'กลาง',
              unit: cmd.unit || 'ชิ้น',
              quantity: cmd.quantity || 1,
              price: cmd.price || 0,
              min_threshold: 1
            };
            const { data } = await supabase.from('products').insert([newItem]).select();
            if (data) {
              setProducts(prev => [data[0], ...prev]);
              msg.push(`• เพิ่มรายการใหม่ "${newItem.name}" เรียบร้อย`);
            }
          } else {
            const match = products.find(p => p.name.includes(cmd.target_name) || cmd.target_name.includes(p.name));
            if (match) {
              if (cmd.action === 'DEDUCT' || cmd.action === 'ADD') {
                const change = cmd.action === 'DEDUCT' ? -Math.abs(cmd.quantity || 1) : Math.abs(cmd.quantity || 1);
                await updateQuantity(match.id, match.quantity + change, match.name);
                msg.push(`• ${cmd.action === 'DEDUCT' ? 'ตัด' : 'เติม'} "${match.name}" ${Math.abs(change)} ${match.unit}`);
              } else if (cmd.action === 'DELETE') {
                await softDeleteProduct(match.id, match.name);
                msg.push(`• ย้าย "${match.name}" ไปถังขยะเรียบร้อย`);
              }
            }
          }
        }
        if (msg.length > 0) alert(`✅ ทำรายการสำเร็จ:\n${msg.join('\n')}`);
        setQuickCmd('');
      }
    } catch (err) {
      alert('⚠️ เกิดข้อผิดพลาดในการประมวลผล');
    } finally {
      setCmdProcessing(false);
    }
  };

  const updateQuantity = async (id, newQty, productName = '') => {
    const finalQty = isNaN(newQty) ? 0 : Math.max(0, newQty);
    const p = products.find(x => x.id === id);
    const diff = finalQty - (p?.quantity || 0);

    setProducts(prev => prev.map(item => item.id === id ? { ...item, quantity: finalQty } : item));
    if (selectedProduct?.id === id) setSelectedProduct(prev => ({ ...prev, quantity: finalQty }));

    await supabase.from('products').update({ quantity: finalQty }).eq('id', id);
    if (diff !== 0) logAction(id, productName || p?.name, diff > 0 ? 'ADD' : 'DEDUCT', Math.abs(diff));
  };

  const togglePin = async (id) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const newPin = !p.isPinned;
    setProducts(prev => prev.map(item => item.id === id ? { ...item, isPinned: newPin } : item));
    if (selectedProduct?.id === id) setSelectedProduct(prev => ({ ...prev, isPinned: newPin }));
    await supabase.from('products').update({ isPinned: newPin }).eq('id', id);
  };

  const softDeleteProduct = async (id, name) => {
    if (confirm(`ย้าย "${name}" ไปถังขยะกู้คืน 24 ชั่วโมง?`)) {
      const now = new Date().toISOString();
      await supabase.from('products').update({ deleted_at: now }).eq('id', id);
      setProducts(prev => prev.filter(x => x.id !== id));
      if (selectedProduct?.id === id) setSelectedProduct(null);
      fetchProducts();
    }
  };

  const restoreProduct = async (id) => {
    await supabase.from('products').update({ deleted_at: null }).eq('id', id);
    fetchProducts();
    alert('♻️ กู้คืนรายการสินค้ากลับเข้าสต๊อกเรียบร้อย!');
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('กรุณากรอกชื่อสินค้า');

    if (editingId) {
      await supabase.from('products').update(formData).eq('id', editingId);
      setProducts(prev => prev.map(p => p.id === editingId ? { ...p, ...formData } : p));
      if (selectedProduct?.id === editingId) setSelectedProduct({ ...selectedProduct, ...formData });
      alert('🎉 แก้ไขข้อมูลเรียบร้อย!');
    } else {
      const { data } = await supabase.from('products').insert([formData]).select();
      if (data) {
        setProducts([data[0], ...products]);
        logAction(data[0].id, data[0].name, 'CREATE', data[0].quantity);
        alert('🎉 บันทึกของเข้าบ้านเรียบร้อย!');
      }
    }
    setShowAddModal(false);
  };

  const openAddModal = (product = null) => {
    if (product) {
      setEditingId(product.id);
      setFormData({ ...product });
      setImagePreview(product.image_url || '');
    } else {
      setEditingId(null);
      setFormData({
        name: '', brand: '', category: 'ห้องครัวและของกิน', unit: 'ถุง', size: 'กลาง',
        volume: '', quantity: 1, min_threshold: 1, price: 0, store: '', image_url: ''
      });
      setImagePreview('');
    }
    setShowAddModal(true);
  };

  // เพิ่ม/ลบ ตัวเลือก Custom (ข้อ 2)
  const handleAddCustomOption = () => {
    const val = newOptionInput.value.trim();
    if (!val) return;
    if (newOptionInput.type === 'category' && !categories.includes(val)) setCategories([...categories, val]);
    if (newOptionInput.type === 'unit' && !units.includes(val)) setUnits([...units, val]);
    if (newOptionInput.type === 'size' && !sizes.includes(val)) setSizes([...sizes, val]);
    setNewOptionInput({ ...newOptionInput, value: '' });
  };

  const handleDeleteCustomOption = async (type, itemToDelete) => {
    if (type === 'category') {
      if (itemToDelete === 'ทั้งหมด' || itemToDelete === 'อื่นๆ') return alert('ไม่สามารถลบหมวดหมู่นี้ได้');
      setCategories(categories.filter(c => c !== itemToDelete));
      if (activeCategory === itemToDelete) setActiveCategory('ทั้งหมด');
      // ย้ายสินค้าในหมวดที่ลบไปอยู่หมวด "อื่นๆ" (ข้อ 2)
      await supabase.from('products').update({ category: 'อื่นๆ' }).eq('category', itemToDelete);
      fetchProducts();
    } else if (type === 'unit') {
      setUnits(units.filter(u => u !== itemToDelete));
    } else if (type === 'size') {
      setSizes(sizes.filter(s => s !== itemToDelete));
    }
  };

  const exportToExcel = () => {
    const timeStr = new Date().toLocaleString('th-TH');
    let csv = `\uFEFFรายงานสต๊อกของใช้ในบ้าน (ข้อมูล ณ วันที่: ${timeStr})\n\n`;
    csv += 'ชื่อสินค้า,ยี่ห้อ,หมวดหมู่,ขนาด,ปริมาณ,หน่วยนับ,สต๊อกคงเหลือ,เกณฑ์ขั้นต่ำ,ราคาล่าสุด,ร้านค้าที่ซื้อ\n';

    products.forEach(p => {
      csv += `"${p.name}","${p.brand || ''}","${p.category}","${p.size || ''}","${p.volume || ''}","${p.unit}","${p.quantity}","${p.min_threshold}","${p.price || 0}","${p.store || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `HomeStock_Report_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  // สั่งพิมพ์รายงาน PDF สวยงาม (ข้อ 1)
  const exportToPDF = () => {
    const timeStr = new Date().toLocaleString('th-TH');
    const printWindow = window.open('', '_blank');
    
    let html = `
      <html>
      <head>
        <title>รายงานสต๊อกของใช้ในบ้าน</title>
        <style>
          body { font-family: 'Sarabun', sans-serif; padding: 20px; color: #333; }
          h1 { color: #16a34a; margin-bottom: 5px; }
          .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f0fdf4; color: #16a34a; }
          .footer { margin-top: 30px; font-size: 11px; text-align: center; color: #888; }
        </style>
      </head>
      <body>
        <h1>🏡 รายงานสรุปสต๊อกของใช้ในบ้าน (Home Stock)</h1>
        <div class="meta">🕒 ข้อมูล ณ วันที่: ${timeStr} | จำนวนทั้งหมด: ${products.length} รายการ</div>
        <table>
          <thead>
            <tr>
              <th>ชื่อสินค้า</th><th>ยี่ห้อ</th><th>หมวดหมู่</th><th>ขนาด</th><th>ปริมาณ</th><th>คงเหลือ</th><th>ราคา</th><th>ร้านค้า</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td><b>${p.name}</b></td>
                <td>${p.brand || '-'}</td>
                <td>${p.category}</td>
                <td>${p.size || '-'}</td>
                <td>${p.volume || '-'}</td>
                <td>${p.quantity} ${p.unit}</td>
                <td>${p.price || 0} บาท</td>
                <td>${p.store || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">พิมพ์จากระบบ Home Stock Management System</div>
        <script>window.print();</script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const lowStockItems = products.filter(p => p.quantity <= p.min_threshold);
  const totalBudgetNeeded = lowStockItems.reduce((sum, item) => {
    const needToBuy = Math.max(1, item.min_threshold - item.quantity + 1);
    return sum + (needToBuy * (item.price || 0));
  }, 0);

  const filteredProducts = products.filter(p => {
    const matchCat = activeCategory === 'ทั้งหมด' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  const pinnedProducts = products.filter(p => p.isPinned);

  return (
    <div className={`min-h-screen pb-24 transition-colors duration-200 ${darkMode ? 'bg-zinc-950 text-zinc-100 dark' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* 🟢 Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏡</span>
            <div>
              <h1 className="font-bold text-lg leading-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Home Stock</h1>
              <p className="text-[10px] text-slate-400">ระบบจัดการของใช้ในบ้าน</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* โหมดมืด/สว่าง เปลี่ยนสีเป๊ะ (ข้อ 3) */}
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setShowSettingsModal(true)} className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
              <Settings size={18} />
            </button>
            <button onClick={() => openAddModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm">
              <Plus size={16} /> <span className="hidden sm:inline">เพิ่มของเข้าบ้าน</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-4">

        {/* ================= PAGE 1: สต๊อกบ้าน ================= */}
        {mainTab === 'stock' && (
          <div className="space-y-4">
            <form onSubmit={handleQuickCommand} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-3.5 shadow-xs">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Sparkles size={16} /> <span>AI พ่อบ้านอัจฉริยะ (สั่งงานด้วยภาษาพูด)</span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="💬 พิมพ์แชทสั่ง เช่น 'ใช้น้ำยาล้างจาน 1 ถุง' หรือ 'เพิ่มสายชาร์จ 2 เมตร 150 บาท'..."
                  value={quickCmd}
                  onChange={(e) => setQuickCmd(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-zinc-800 border-0 rounded-2xl py-2.5 pl-3.5 pr-20 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white"
                />
                <button type="submit" disabled={cmdProcessing} className="absolute right-1.5 bg-slate-900 dark:bg-emerald-600 text-white text-[11px] font-medium px-3.5 py-1.5 rounded-xl">
                  {cmdProcessing ? 'กำลังสั่ง...' : 'สั่งงาน'}
                </button>
              </div>
            </form>

            {pinnedProducts.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-zinc-300">
                  <span className="text-amber-500">⭐</span><span>ของใช้บ่อยประจำบ้าน (ปักหมุดไว้)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {pinnedProducts.map(item => (
                    <div key={item.id} className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-2.5 shadow-xs flex items-center gap-2">
                      <div onClick={() => setSelectedProduct(item)} className="w-9 h-9 bg-slate-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 text-lg cursor-pointer">
                        {item.image_url ? <img src={item.image_url} className="w-full h-full object-contain rounded-xl" /> : '📦'}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-bold text-xs truncate dark:text-zinc-100">{item.name}</h4>
                        <p className="text-[10px] text-slate-400 truncate">{item.brand} • {item.size}</p>
                      </div>
                      <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.name)} className="w-5 h-5 flex items-center justify-center text-xs font-bold bg-white dark:bg-zinc-700 rounded">-</button>
                        <span className="text-xs font-bold px-1">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.name)} className="w-5 h-5 flex items-center justify-center text-xs font-bold bg-white dark:bg-zinc-700 rounded">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="space-y-2.5">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อสินค้า, ยี่ห้อ หรือขนาด..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl py-2 pl-10 pr-4 text-xs dark:text-white"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap transition ${activeCategory === cat ? 'bg-emerald-600 text-white font-bold' : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-400 text-xs">กำลังโหลดสต๊อก...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 text-slate-400 text-xs">ไม่พบรายการสินค้า</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {filteredProducts.map(item => {
                  const needsRefill = item.quantity <= item.min_threshold;
                  const refillDiff = item.min_threshold - item.quantity + 1;

                  return (
                    <div key={item.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 shadow-xs flex gap-3 items-center relative overflow-hidden">
                      <div onClick={() => setSelectedProduct(item)} className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-xl flex-shrink-0 border border-slate-100 dark:border-zinc-800 flex items-center justify-center text-2xl cursor-pointer relative group overflow-hidden">
                        {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" /> : <Package size={24} className="text-slate-300" />}
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition rounded-xl">
                          <Eye size={16} className="text-white" />
                        </div>
                      </div>

                      <div onClick={() => setSelectedProduct(item)} className="flex-grow min-w-0 cursor-pointer">
                        <div className="flex items-center gap-1 text-[9px] font-bold mb-0.5">
                          <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded truncate">{item.category} • {item.size}</span>
                        </div>
                        <h3 className="font-bold text-xs truncate dark:text-zinc-100">{item.name}</h3>
                        <p className="text-[11px] text-slate-400 truncate">{item.brand ? `ยี่ห้อ: ${item.brand}` : 'ไม่ระบุยี่ห้อ'} {item.volume ? `(${item.volume})` : ''}</p>
                        
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{item.price || 0} บ. {item.store ? `• ${item.store}` : ''}</span>
                          {needsRefill && <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.2 rounded font-bold">⚠️ ซื้อเพิ่ม +{refillDiff} {item.unit}</span>}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <button onClick={() => togglePin(item.id)} className="p-0.5">
                            <Pin size={14} className={item.isPinned ? 'fill-amber-500 text-amber-500' : 'text-slate-300'} />
                          </button>
                          <button onClick={() => openAddModal(item)} className="p-0.5 text-slate-300 hover:text-emerald-600">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => softDeleteProduct(item.id, item.name)} className="p-0.5 text-slate-300 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="flex items-center bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-0.5">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.name)} className="w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-zinc-300">-</button>
                          <input
                            type="number"
                            value={item.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0, item.name)}
                            className="w-8 text-center text-xs font-bold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded py-0.5 dark:text-white"
                          />
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.name)} className="w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-zinc-300">+</button>
                        </div>
                        <span className="text-[9px] text-slate-400">ขั้นต่ำ: {item.min_threshold} {item.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= PAGE 2: เช็กราคา & วางแผนซื้อ ================= */}
        {mainTab === 'price' && (
          <div className="space-y-4">
            <div className="flex bg-slate-200 dark:bg-zinc-800 p-1 rounded-2xl text-xs font-semibold">
              <button onClick={() => setPriceSubTab('system')} className={`flex-1 py-2 rounded-xl text-center ${priceSubTab === 'system' ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-slate-500'}`}>
                🛒 รายการในระบบ & สรุปงบต้องซื้อ
              </button>
              <button onClick={() => setPriceSubTab('temp')} className={`flex-1 py-2 rounded-xl text-center ${priceSubTab === 'temp' ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-slate-500'}`}>
                🧮 เครื่องคิดเลขเทียบราคา & ตะกร้าสด
              </button>
            </div>

            {priceSubTab === 'system' ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 p-4 rounded-3xl flex justify-between items-center">
                  <div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">🛒 ยอดเงินรวมต้องเตรียมไปซื้อของ (ของใกล้หมด):</p>
                    <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">{totalBudgetNeeded} บาท</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 space-y-3">
                  <h3 className="font-bold text-xs text-slate-700 dark:text-zinc-200">เปรียบเทียบราคาสินค้าที่มีในระบบ</h3>
                  {products.map(p => (
                    <div key={p.id} className="border-b border-slate-100 dark:border-zinc-800 pb-2 text-xs flex justify-between items-center">
                      <div>
                        <p className="font-bold">{p.name} ({p.brand || 'ไม่ระบุ'})</p>
                        <p className="text-[10px] text-slate-400">{p.size} • {p.volume || 'ไม่ระบุปริมาณ'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">{p.price || 0} บาท</p>
                        <p className="text-[10px] text-slate-400">ร้าน: {p.store || 'ไม่ระบุ'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 space-y-3">
                  <h4 className="font-bold text-xs text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                    <ShoppingCart size={16} className="text-emerald-600" />
                    <span>🛒 ตะกร้าคำนวณเงินสด (เช็กยอดเงินขณะเดินหยิบของในห้าง)</span>
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ชื่อสินค้า"
                      value={cartName}
                      onChange={(e) => setCartName(e.target.value)}
                      className="flex-1 p-2 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 text-xs"
                    />
                    <input
                      type="number"
                      placeholder="ราคา (บาท)"
                      value={cartPrice}
                      onChange={(e) => setCartPrice(e.target.value)}
                      className="w-28 p-2 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 text-xs font-bold"
                    />
                    <button onClick={() => {
                      if (!cartPrice) return;
                      setCartItems([...cartItems, { id: Date.now(), name: cartName || 'สินค้าทั่วไป', price: parseFloat(cartPrice) }]);
                      setCartName(''); setCartPrice('');
                    }} className="bg-emerald-600 text-white text-xs px-3 rounded-xl font-bold">+ ใส่ตะกร้า</button>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    {cartItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center bg-slate-50 dark:bg-zinc-800 p-1.5 rounded-xl text-xs">
                        <span>{item.name}</span>
                        <div className="flex items-center gap-2 font-bold">
                          <span>{item.price} บาท</span>
                          <button onClick={() => setCartItems(cartItems.filter(x => x.id !== item.id))} className="text-red-500 font-bold px-1">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-zinc-700 font-bold">
                    <span className="text-xs">ยอดรวมในตะกร้าขณะนี้:</span>
                    <span className="text-lg text-emerald-600 dark:text-emerald-400">{cartItems.reduce((sum, item) => sum + item.price, 0)} บาท</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 space-y-3">
                  <h4 className="font-bold text-xs text-slate-700 dark:text-zinc-200">⚖️ เครื่องคิดเลขเปรียบเทียบราคาเฉลี่ยต่อหน่วย</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-2 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl">
                      <span className="font-bold text-emerald-600">ตัวเลือก 1 (เช่น ขวด)</span>
                      <input type="number" placeholder="ราคา (บาท)" value={tempCalc.p1} onChange={(e) => setTempCalc({ ...tempCalc, p1: e.target.value })} className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-900 text-xs" />
                      <input type="number" placeholder="ปริมาณ (ml/กรัม)" value={tempCalc.v1} onChange={(e) => setTempCalc({ ...tempCalc, v1: e.target.value })} className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-900 text-xs" />
                      <p className="text-xs font-extrabold pt-1">ตกหน่วยละ: {tempCalc.p1 && tempCalc.v1 ? (tempCalc.p1 / tempCalc.v1).toFixed(3) : '-'} บาท</p>
                    </div>
                    <div className="space-y-2 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl">
                      <span className="font-bold text-blue-600">ตัวเลือก 2 (เช่น ถุงเติม)</span>
                      <input type="number" placeholder="ราคา (บาท)" value={tempCalc.p2} onChange={(e) => setTempCalc({ ...tempCalc, p2: e.target.value })} className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-900 text-xs" />
                      <input type="number" placeholder="ปริมาณ (ml/กรัม)" value={tempCalc.v2} onChange={(e) => setTempCalc({ ...tempCalc, v2: e.target.value })} className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-900 text-xs" />
                      <p className="text-xs font-extrabold pt-1">ตกหน่วยละ: {tempCalc.p2 && tempCalc.v2 ? (tempCalc.p2 / tempCalc.v2).toFixed(3) : '-'} บาท</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= PAGE 3: ประวัติ & ถังขยะ (ข้อ 6) ================= */}
        {mainTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-700 dark:text-zinc-200">📜 ประวัติการใช้งานย้อนหลัง (สูงสุด 500 รายการ)</h3>
              {logs.length > 0 && (
                <button onClick={clearAllLogs} className="text-xs text-red-500 hover:underline font-bold">
                  ล้างประวัติทั้งหมด
                </button>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 space-y-3 text-xs">
              {logs.length === 0 ? <p className="text-slate-400 text-center py-4">ยังไม่มีประวัติการใช้งาน</p> : logs.map(log => (
                <div key={log.id} className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                  <div className="flex items-start gap-3">
                    <span className={`p-1.5 rounded-xl font-bold ${log.action_type === 'DEDUCT' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {log.action_type === 'DEDUCT' ? '-' : '+'}{log.quantity_changed}
                    </span>
                    <div>
                      <p className="font-bold dark:text-zinc-100">{log.action_type === 'DEDUCT' ? 'นำออกไปใช้' : 'เติมของเข้าบ้าน'} ({log.quantity_changed} ชิ้น)</p>
                      <p className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString('th-TH')}</p>
                    </div>
                  </div>
                  {/* ปุ่มลบประวัติเฉพาะบรรทัด (ข้อ 6) */}
                  <button onClick={() => deleteSingleLog(log.id)} className="text-slate-300 hover:text-red-500 p-1">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/40 rounded-3xl p-4 space-y-2">
              <h4 className="font-bold text-xs text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <Trash2 size={16} /> <span>🗑️ ถังขยะกู้คืนข้อมูล (คงไว้ 24 ชั่วโมง)</span>
              </h4>
              {trashItems.length === 0 ? <p className="text-xs text-slate-400 py-2">ไม่มีรายการในถังขยะ</p> : trashItems.map(item => (
                <div key={item.id} className="bg-amber-50/50 dark:bg-zinc-800 p-2.5 rounded-2xl text-xs flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-700 dark:text-zinc-200">{item.name}</p>
                    <p className="text-[10px] text-slate-400">ลบเมื่อ: {new Date(item.deleted_at).toLocaleString('th-TH')}</p>
                  </div>
                  <button onClick={() => restoreProduct(item.id)} className="bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1">
                    <RotateCcw size={12} /> กู้คืน
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* 👁️ MODAL: รายละเอียดสินค้า + ปุ่มกดแก้ไข/ปักหมุด/ลบ (ข้อ 4) */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto text-xs relative">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 text-slate-400"><X size={20} /></button>

            <div className="w-full h-48 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 dark:border-zinc-800">
              {selectedProduct.image_url ? <img src={selectedProduct.image_url} className="w-full h-full object-contain" /> : <Package size={48} className="text-slate-300" />}
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{selectedProduct.category} • {selectedProduct.size}</span>
              <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 mt-1">{selectedProduct.name}</h3>
              <p className="text-xs text-slate-400">ยี่ห้อ: {selectedProduct.brand || 'ไม่ระบุ'} | ปริมาณ: {selectedProduct.volume || 'ไม่ระบุ'}</p>
              <p className="text-xs font-bold text-emerald-600">ราคาล่าสุด: {selectedProduct.price || 0} บาท ({selectedProduct.store || 'ไม่ระบุร้าน'})</p>
              <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">สต๊อกคงเหลือ: {selectedProduct.quantity} {selectedProduct.unit} (เกณฑ์ขั้นต่ำ {selectedProduct.min_threshold} {selectedProduct.unit})</p>
            </div>

            {/* ปุ่มกด ปักหมุด, แก้ไข, ลบ ในหน้ารายละเอียด (ข้อ 4) */}
            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button onClick={() => togglePin(selectedProduct.id)} className={`flex-1 py-2 rounded-xl border flex items-center justify-center gap-1 font-bold ${selectedProduct.isPinned ? 'bg-amber-50 border-amber-200 text-amber-600' : 'border-slate-200 text-slate-600'}`}>
                <Pin size={14} /> {selectedProduct.isPinned ? 'ปักหมุดอยู่' : 'ปักหมุด'}
              </button>
              <button onClick={() => { setSelectedProduct(null); openAddModal(selectedProduct); }} className="flex-1 py-2 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl font-bold flex items-center justify-center gap-1">
                <Edit3 size={14} /> แก้ไข
              </button>
              <button onClick={() => softDeleteProduct(selectedProduct.id, selectedProduct.name)} className="py-2 px-3 bg-red-50 border border-red-200 text-red-600 rounded-xl font-bold flex items-center justify-center">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📸 MODAL: บันทึก/แก้ไขสินค้า */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-2">
              <h3 className="font-bold text-sm">{editingId ? '✏️ แก้ไขข้อมูลสินค้า' : '📸 บันทึกของเข้าบ้าน'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400"><X size={20} /></button>
            </div>

            <div className="border-2 border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-3 text-center relative">
              <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              {imagePreview ? (
                <div className="h-32 w-full relative">
                  <img src={imagePreview} className="h-full mx-auto object-contain rounded-xl" />
                  <p className="text-[10px] text-emerald-700 font-bold mt-1">กดเปลี่ยนรูปถ่ายใหม่ได้</p>
                </div>
              ) : (
                <>
                  <Camera size={24} className="mx-auto text-emerald-600 mb-1" />
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">{aiProcessing ? '⚡ AI กำลังอ่านฉลาก...' : 'ถ่ายรูปหน้าซอง/ขวด (ให้ AI อ่านอัตโนมัติ)'}</span>
                </>
              )}
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-2">
              <div>
                <label className="block font-medium text-slate-500 mb-0.5">ชื่อสินค้า *</label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 rounded-xl border dark:border-zinc-700 dark:bg-zinc-800" placeholder="เช่น น้ำยาล้างจาน" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-500 mb-0.5">ยี่ห้อ</label>
                  <input type="text" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="w-full p-2 rounded-xl border dark:border-zinc-700 dark:bg-zinc-800" placeholder="เช่น ซันไลต์" />
                </div>
                <div>
                  <label className="block font-medium text-slate-500 mb-0.5">หมวดหมู่</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full p-2 rounded-xl border dark:border-zinc-700 dark:bg-zinc-800">
                    {categories.filter(c => c !== 'ทั้งหมด').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-slate-500 mb-0.5">ขนาด</label>
                  <select value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} className="w-full p-2 rounded-xl border dark:border-zinc-700 dark:bg-zinc-800">
                    {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-500 mb-0.5">หน่วยนับ</label>
                  <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full p-2 rounded-xl border dark:border-zinc-700 dark:bg-zinc-800">
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-500 mb-0.5">ปริมาณ/ขวด</label>
                  <input type="text" value={formData.volume} onChange={(e) => setFormData({ ...formData, volume: e.target.value })} className="w-full p-2 rounded-xl border dark:border-zinc-700 dark:bg-zinc-800" placeholder="500ml" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-500 mb-0.5">ราคาล่าสุด (บาท)</label>
                  <input type="number" value={formData.price} onFocus={(e) => e.target.select()} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} className="w-full p-2 rounded-xl border dark:border-zinc-700 dark:bg-zinc-800 font-bold" />
                </div>
                <div>
                  <label className="block font-medium text-slate-500 mb-0.5">ร้านค้าที่ซื้อ</label>
                  <input type="text" value={formData.store} onChange={(e) => setFormData({ ...formData, store: e.target.value })} className="w-full p-2 rounded-xl border dark:border-zinc-700 dark:bg-zinc-800" placeholder="เช่น CJ More" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-500 mb-0.5">จำนวนที่ซื้อมา</label>
                  <input type="number" value={formData.quantity} onFocus={(e) => e.target.select()} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} className="w-full p-2 rounded-xl border dark:border-zinc-700 dark:bg-zinc-800 font-bold" />
                </div>
                <div>
                  <label className="block font-medium text-slate-500 mb-0.5">เกณฑ์เตือนขั้นต่ำ</label>
                  <input type="number" value={formData.min_threshold} onFocus={(e) => e.target.select()} onChange={(e) => setFormData({ ...formData, min_threshold: parseInt(e.target.value) || 1 })} className="w-full p-2 rounded-xl border dark:border-zinc-700 dark:bg-zinc-800" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="w-1/2 bg-slate-100 dark:bg-zinc-800 py-2.5 rounded-xl font-medium">ยกเลิก</button>
                <button type="submit" className="w-1/2 bg-emerald-600 text-white py-2.5 rounded-xl font-medium shadow-md">บันทึกสต๊อก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⚙️ MODAL: การตั้งค่า + สั่งพิมพ์ PDF & ลบตัวเลือก Custom (ข้อ 1 & 2) */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-2">
              <h3 className="font-bold text-sm flex items-center gap-1.5"><Settings size={16} /> การตั้งค่าระบบ</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400"><X size={20} /></button>
            </div>

            {/* ส่งออก Excel & PDF (ข้อ 1) */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-500">📊 ส่งออกรายงาน (ประทับวันเวลาให้อัตโนมัติ)</h4>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportToExcel} className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 rounded-2xl font-semibold flex items-center justify-center gap-1">
                  <FileSpreadsheet size={16} /> ไฟล์ Excel
                </button>
                <button onClick={exportToPDF} className="p-2.5 bg-red-50 text-red-700 dark:bg-red-950/60 rounded-2xl font-semibold flex items-center justify-center gap-1">
                  <FileText size={16} /> รายงาน PDF
                </button>
              </div>
            </div>

            {/* เพิ่ม/ลบ ตัวเลือก Custom (ข้อ 2) */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <h4 className="font-bold text-slate-500">✏️ จัดการตัวเลือก (เพิ่ม/ลบ หมวดหมู่ ขนาด หน่วยนับ)</h4>
              <div className="flex gap-2 mb-2">
                <select value={newOptionInput.type} onChange={(e) => setNewOptionInput({ ...newOptionInput, type: e.target.value })} className="p-2 border rounded-xl dark:bg-zinc-800">
                  <option value="category">หมวดหมู่</option>
                  <option value="size">ขนาด</option>
                  <option value="unit">หน่วยนับ</option>
                </select>
                <input type="text" placeholder="ชื่อตัวเลือกใหม่..." value={newOptionInput.value} onChange={(e) => setNewOptionInput({ ...newOptionInput, value: e.target.value })} className="flex-1 p-2 border rounded-xl dark:bg-zinc-800" />
                <button onClick={handleAddCustomOption} className="bg-emerald-600 text-white px-3 rounded-xl font-bold">+ เพิ่ม</button>
              </div>

              <!-- รายการสำหรับกดลบตัวเลือกเดิม -->
              <div className="space-y-2 max-h-40 overflow-y-auto pt-1">
                <p className="font-bold text-[10px] text-slate-400">รายการหมวดหมู่ที่มีอยู่ (กด ✕ เพื่อลบ):</p>
                <div className="flex flex-wrap gap-1">
                  {categories.map(c => (
                    <span key={c} className="bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-lg text-[10px] flex items-center gap-1">
                      {c}
                      {c !== 'ทั้งหมด' && c !== 'อื่นๆ' && (
                        <button onClick={() => handleDeleteCustomOption('category', c)} className="text-red-500 font-bold ml-1">✕</button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📱 Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 py-2 z-30">
        <div className="max-w-md mx-auto flex justify-around items-center text-[10px]">
          <button onClick={() => setMainTab('stock')} className={`flex flex-col items-center gap-1 ${mainTab === 'stock' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
            <HomeIcon size={20} /><span>สต๊อกบ้าน</span>
          </button>
          <button onClick={() => setMainTab('price')} className={`flex flex-col items-center gap-1 ${mainTab === 'price' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
            <Tag size={20} /><span>เช็กราคา & ซื้อของ</span>
          </button>
          <button onClick={() => setMainTab('history')} className={`flex flex-col items-center gap-1 ${mainTab === 'history' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
            <Clock size={20} /><span>ประวัติ & ถังขยะ</span>
          </button>
        </div>
      </nav>

    </div>
  );
}
