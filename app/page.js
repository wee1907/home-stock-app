'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Plus, Minus, Search, Camera, AlertTriangle, Package, Trash2, X, Eye, Sparkles, Edit3, 
  Pin, Settings, Sun, Moon, FileSpreadsheet, FileText, ShoppingCart, RotateCcw, Home as HomeIcon, Tag, Clock, ArrowUpDown, Calendar
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
  const [sortBy, setSortBy] = useState('created'); // 'created', 'low_stock', 'price_asc', 'price_desc'
  const [loading, setLoading] = useState(true);
  const [quickCmd, setQuickCmd] = useState('');
  const [cmdProcessing, setCmdProcessing] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

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
  const [manageOptionType, setManageOptionType] = useState('category');
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

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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

  const logAction = async (productId, productName, actionType, qtyChanged) => {
    await supabase.from('usage_logs').insert([{
      product_id: productId,
      action_type: actionType,
      quantity_changed: qtyChanged,
      created_at: new Date().toISOString()
    }]);

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

  const handleAddCustomOption = () => {
    const val = newOptionInput.value.trim();
    if (!val) return;
    if (manageOptionType === 'category' && !categories.includes(val)) setCategories([...categories, val]);
    if (manageOptionType === 'unit' && !units.includes(val)) setUnits([...units, val]);
    if (manageOptionType === 'size' && !sizes.includes(val)) setSizes([...sizes, val]);
    setNewOptionInput({ ...newOptionInput, value: '' });
    alert('✅ เพิ่มตัวเลือกเรียบร้อยแล้ว');
  };

  const handleEditCustomOption = async (type, oldVal) => {
    const newVal = prompt(`แก้ไขชื่อ${type === 'category' ? 'หมวดหมู่' : type === 'size' ? 'ขนาด' : 'หน่วยนับ'} "${oldVal}" เป็น:`, oldVal);
    if (!newVal || newVal.trim() === '' || newVal === oldVal) return;

    const trimmed = newVal.trim();
    if (type === 'category') {
      setCategories(categories.map(c => c === oldVal ? trimmed : c));
      await supabase.from('products').update({ category: trimmed }).eq('category', oldVal);
    } else if (type === 'size') {
      setSizes(sizes.map(s => s === oldVal ? trimmed : s));
      await supabase.from('products').update({ size: trimmed }).eq('size', oldVal);
    } else if (type === 'unit') {
      setUnits(units.map(u => u === oldVal ? trimmed : u));
      await supabase.from('products').update({ unit: trimmed }).eq('unit', oldVal);
    }
    fetchProducts();
    alert('🎉 แก้ไขชื่อเรียบร้อยแล้ว');
  };

  const handleDeleteCustomOption = async (type, itemToDelete) => {
    if (confirm(`คุณต้องการลบ "${itemToDelete}" ออกจากรายการตัวเลือกใช่ไหม?`)) {
      if (type === 'category') {
        if (itemToDelete === 'ทั้งหมด' || itemToDelete === 'อื่นๆ') return alert('ไม่สามารถลบหมวดหมู่นี้ได้');
        setCategories(categories.filter(c => c !== itemToDelete));
        if (activeCategory === itemToDelete) setActiveCategory('ทั้งหมด');
        await supabase.from('products').update({ category: 'อื่นๆ' }).eq('category', itemToDelete);
      } else if (type === 'size') {
        setSizes(sizes.filter(s => s !== itemToDelete));
      } else if (type === 'unit') {
        setUnits(units.filter(u => u !== itemToDelete));
      }
      fetchProducts();
      alert('🗑️ ลบตัวเลือกเรียบร้อยแล้ว');
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

  const exportToPDF = () => {
    const timeStr = new Date().toLocaleString('th-TH');
    const printWindow = window.open('', '_blank');
    
    let html = `
      <html>
      <head>
        <title>รายงานสต๊อกของใช้ในบ้าน</title>
        <style>
          body { font-family: 'Prompt', 'Sarabun', sans-serif; padding: 24px; color: #18181b; background: #fff; }
          h1 { color: #059669; font-size: 20px; font-weight: 700; margin-bottom: 4px; }
          .meta { font-size: 11px; color: #71717a; margin-bottom: 20px; border-bottom: 2px solid #10b981; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th, td { border: 1px solid #e4e4e7; padding: 8px; text-align: left; }
          th { background-color: #f0fdf4; color: #047857; font-weight: 600; }
          .footer { margin-top: 30px; font-size: 10px; text-align: center; color: #a1a1aa; }
        </style>
      </head>
      <body>
        <h1>🏡 รายงานสรุปสต๊อกของใช้ในบ้าน (Home Stock)</h1>
        <div class="meta">🕒 ข้อมูล ณ วันที่: ${timeStr} | รายการทั้งหมด: ${products.length} รายการ</div>
        <table>
          <thead>
            <tr>
              <th>ชื่อสินค้า</th><th>ยี่ห้อ</th><th>หมวดหมู่</th><th>ขนาด</th><th>ปริมาณ</th><th>คงเหลือ</th><th>ราคาล่าสุด</th><th>ร้านค้า</th>
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
                <td><b>${p.quantity} ${p.unit}</b></td>
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

  // การกรอง & จัดเรียงลำดับสินค้า (Sorting)
  let filteredProducts = products.filter(p => {
    const matchCat = activeCategory === 'ทั้งหมด' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  if (sortBy === 'low_stock') {
    filteredProducts.sort((a, b) => (a.quantity - a.min_threshold) - (b.quantity - b.min_threshold));
  } else if (sortBy === 'price_desc') {
    filteredProducts.sort((a, b) => (b.price || 0) - (a.price || 0));
  } else if (sortBy === 'price_asc') {
    filteredProducts.sort((a, b) => (a.price || 0) - (b.price || 0));
  }

  const pinnedProducts = products.filter(p => p.isPinned);

  return (
    <div className="min-h-screen pb-24 transition-colors duration-300">
      
      {/* 🟢 Header Glassmorphism */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-zinc-800/80 px-4 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-500/10 dark:bg-emerald-400/10 rounded-2xl flex items-center justify-center text-xl border border-emerald-500/20">
              🏡
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">Home Stock</h1>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">จัดการของใช้ในบ้านอัจฉริยะ</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:scale-105 active:scale-95 transition">
              {darkMode ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
            </button>
            <button onClick={() => setShowSettingsModal(true)} className="p-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:scale-105 active:scale-95 transition">
              <Settings size={17} />
            </button>
            <button onClick={() => openAddModal()} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition">
              <Plus size={16} /> <span className="hidden sm:inline">เพิ่มของเข้าบ้าน</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-5">

        {/* ================= PAGE 1: สต๊อกบ้าน ================= */}
        {mainTab === 'stock' && (
          <div className="space-y-5">
            {/* AI Hero Glass Box */}
            <form onSubmit={handleQuickCommand} className="bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-transparent dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-900 border border-emerald-500/20 dark:border-zinc-800 rounded-3xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-1.5 mb-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Sparkles size={16} className="animate-pulse" />
                <span>AI พ่อบ้านอัจฉริยะ (แชทสั่งงานด้วยภาษาพูด)</span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="💬 พิมพ์แชทสั่ง เช่น 'ใช้น้ำยาล้างจาน 1 ถุง' หรือ 'เพิ่มสายชาร์จ 2 เมตร 150 บาท'..."
                  value={quickCmd}
                  onChange={(e) => setQuickCmd(e.target.value)}
                  className="w-full bg-white/80 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60 rounded-2xl py-3 pl-4 pr-24 text-xs focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none dark:text-zinc-100 dark:placeholder-zinc-500 shadow-inner"
                />
                <button type="submit" disabled={cmdProcessing} className="absolute right-1.5 bg-zinc-900 dark:bg-emerald-600 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition active:scale-95">
                  {cmdProcessing ? 'กำลังสั่ง...' : 'สั่งงาน'}
                </button>
              </div>
            </form>

            {/* Pinned Favorites */}
            {pinnedProducts.length > 0 && (
              <section className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                  <span className="text-amber-500">⭐</span><span>ของใช้บ่อยประจำบ้าน (ปักหมุดไว้)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {pinnedProducts.map(item => (
                    <div key={item.id} className="bg-white dark:bg-zinc-900/90 border border-amber-200/80 dark:border-amber-900/30 rounded-2xl p-3 shadow-xs flex items-center gap-2.5 hover:border-amber-400 transition">
                      <div onClick={() => setSelectedProduct(item)} className="w-10 h-10 bg-slate-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 text-xl cursor-pointer overflow-hidden border border-slate-200/50 dark:border-zinc-700/50">
                        {item.image_url ? <img src={item.image_url} className="w-full h-full object-contain" /> : '📦'}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-bold text-xs truncate dark:text-zinc-100">{item.name}</h4>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{item.brand} • {item.size}</p>
                      </div>
                      <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.name)} className="w-5 h-5 flex items-center justify-center text-xs font-bold bg-white dark:bg-zinc-700 dark:text-zinc-100 rounded-lg shadow-xs active:scale-90 transition">-</button>
                        <span className="text-xs font-bold px-1.5 dark:text-zinc-100">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.name)} className="w-5 h-5 flex items-center justify-center text-xs font-bold bg-white dark:bg-zinc-700 dark:text-zinc-100 rounded-lg shadow-xs active:scale-90 transition">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Search Bar & Sorting */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-3.5 text-slate-400 dark:text-zinc-500" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อสินค้า, ยี่ห้อ หรือขนาด..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl py-2.5 pl-11 pr-4 text-xs dark:text-zinc-100 dark:placeholder-zinc-500 shadow-xs focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Sorting Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 dark:bg-zinc-800 focus:outline-none"
                >
                  <option value="created">🕒 ล่าสุด</option>
                  <option value="low_stock">⚠️ ของใกล้หมดขึ้นก่อน</option>
                  <option value="price_desc">💵 ราคา แพง-ถูก</option>
                  <option value="price_asc">🏷️ ราคา ถูก-แพง</option>
                </select>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 rounded-xl whitespace-nowrap transition font-medium text-xs ${activeCategory === cat ? 'bg-emerald-600 text-white font-semibold shadow-sm' : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards Grid */}
            {loading ? (
              <div className="text-center py-16 text-slate-400 dark:text-zinc-500 text-xs">กำลังโหลดสต๊อก...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-zinc-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 text-xs">ไม่พบรายการสินค้า</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(item => {
                  const needsRefill = item.quantity <= item.min_threshold;
                  const refillDiff = item.min_threshold - item.quantity + 1;

                  return (
                    <div key={item.id} className="bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-3xl p-3.5 shadow-xs hover:shadow-md hover:border-emerald-500/30 transition-all duration-200 flex gap-3.5 items-center relative overflow-hidden group">
                      
                      {/* Photo Thumbnail */}
                      <div onClick={() => setSelectedProduct(item)} className="w-18 h-18 bg-slate-100 dark:bg-zinc-800/80 rounded-2xl flex-shrink-0 border border-slate-200/60 dark:border-zinc-700/50 flex items-center justify-center text-2xl cursor-pointer relative overflow-hidden group-hover:scale-102 transition">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" />
                        ) : (
                          <Package size={26} className="text-slate-300 dark:text-zinc-600" />
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition backdrop-blur-xs">
                          <Eye size={18} className="text-white" />
                        </div>
                      </div>

                      {/* Content Details */}
                      <div onClick={() => setSelectedProduct(item)} className="flex-grow min-w-0 cursor-pointer space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/10 dark:border-emerald-500/20 px-2 py-0.5 rounded-lg truncate max-w-full">
                            {item.category} • {item.size}
                          </span>
                        </div>
                        <h3 className="font-bold text-xs text-slate-800 dark:text-zinc-100 truncate">{item.name}</h3>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-400 truncate">
                          {item.brand ? `ยี่ห้อ: ${item.brand}` : 'ไม่ระบุยี่ห้อ'} {item.volume ? `(${item.volume})` : ''}
                        </p>
                        
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-extrabold">{item.price || 0} บ. {item.store ? `• ${item.store}` : ''}</span>
                          {needsRefill && (
                            <span className="text-[9px] bg-red-50 dark:bg-red-950/60 border border-red-200/60 dark:border-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-md font-bold truncate">
                              ⚠️ ซื้อเพิ่ม +{refillDiff} {item.unit}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => togglePin(item.id)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
                            <Pin size={14} className={item.isPinned ? 'fill-amber-500 text-amber-500' : 'text-slate-300 dark:text-zinc-600'} />
                          </button>
                          <button onClick={() => openAddModal(item)} className="p-1 text-slate-300 dark:text-zinc-600 hover:text-emerald-600 transition">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => softDeleteProduct(item.id, item.name)} className="p-1 text-slate-300 dark:text-zinc-600 hover:text-red-500 transition">
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="flex items-center bg-slate-100 dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700/60 rounded-xl p-1 shadow-inner">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.name)} className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition active:scale-90">-</button>
                          <input
                            type="number"
                            value={item.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0, item.name)}
                            className="w-9 text-center text-xs font-extrabold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md py-0.5 text-slate-900 dark:text-white shadow-xs"
                          />
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.name)} className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition active:scale-90">+</button>
                        </div>
                        <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-medium">ขั้นต่ำ: {item.min_threshold} {item.unit}</span>
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
          <div className="space-y-5">
            <div className="flex bg-slate-200/80 dark:bg-zinc-800/80 p-1.5 rounded-2xl text-xs font-semibold">
              <button onClick={() => setPriceSubTab('system')} className={`flex-1 py-2.5 rounded-xl text-center transition ${priceSubTab === 'system' ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold' : 'text-slate-500 dark:text-zinc-400'}`}>
                🛒 รายการในระบบ & สรุปงบต้องซื้อ
              </button>
              <button onClick={() => setPriceSubTab('temp')} className={`flex-1 py-2.5 rounded-xl text-center transition ${priceSubTab === 'temp' ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold' : 'text-slate-500 dark:text-zinc-400'}`}>
                🧮 เครื่องคิดเลขเทียบราคา & ตะกร้าสด
              </button>
            </div>

            {priceSubTab === 'system' ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border border-emerald-500/20 dark:border-emerald-900/40 p-5 rounded-3xl flex justify-between items-center shadow-xs">
                  <div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">🛒 ยอดเงินรวมต้องเตรียมไปซื้อของ (ของใกล้หมด):</p>
                    <p className="text-3xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-1">{totalBudgetNeeded.toLocaleString()} <span className="text-base font-normal">บาท</span></p>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 space-y-3 shadow-xs">
                  <h3 className="font-bold text-xs text-slate-800 dark:text-zinc-100">เปรียบเทียบราคาสินค้าที่มีในระบบ</h3>
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {products.map(p => (
                      <div key={p.id} className="py-2.5 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-zinc-100">{p.name} ({p.brand || 'ไม่ระบุ'})</p>
                          <p className="text-[10px] text-slate-400 dark:text-zinc-400">{p.size} • {p.volume || 'ไม่ระบุปริมาณ'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600 dark:text-emerald-400">{p.price || 0} บาท</p>
                          <p className="text-[10px] text-slate-400 dark:text-zinc-400">ร้าน: {p.store || 'ไม่ระบุ'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 space-y-3.5 shadow-xs">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                    <ShoppingCart size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <span>🛒 ตะกร้าคำนวณเงินสด (เช็กยอดเงินขณะเดินหยิบของในห้าง)</span>
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ชื่อสินค้า"
                      value={cartName}
                      onChange={(e) => setCartName(e.target.value)}
                      className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white text-xs"
                    />
                    <input
                      type="number"
                      placeholder="ราคา (บาท)"
                      value={cartPrice}
                      onChange={(e) => setCartPrice(e.target.value)}
                      className="w-28 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white text-xs font-bold"
                    />
                    <button onClick={() => {
                      if (!cartPrice) return;
                      setCartItems([...cartItems, { id: Date.now(), name: cartName || 'สินค้าทั่วไป', price: parseFloat(cartPrice) }]);
                      setCartName(''); setCartPrice('');
                    }} className="bg-emerald-600 text-white text-xs px-4 rounded-xl font-bold active:scale-95 transition">+ ใส่ตะกร้า</button>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    {cartItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center bg-slate-50 dark:bg-zinc-800/80 p-2 rounded-xl text-xs dark:text-zinc-200">
                        <span>{item.name}</span>
                        <div className="flex items-center gap-3 font-bold">
                          <span>{item.price} บาท</span>
                          <button onClick={() => setCartItems(cartItems.filter(x => x.id !== item.id))} className="text-red-500 font-bold px-1">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-zinc-700 font-bold">
                    <span className="text-xs dark:text-zinc-200">ยอดรวมในตะกร้าขณะนี้:</span>
                    <span className="text-xl text-emerald-600 dark:text-emerald-400 font-extrabold">{cartItems.reduce((sum, item) => sum + item.price, 0)} บาท</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 space-y-3.5 shadow-xs">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-zinc-100">⚖️ เครื่องคิดเลขเปรียบเทียบราคาเฉลี่ยต่อหน่วย</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-2 bg-slate-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-zinc-700/60">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">ตัวเลือก 1 (เช่น ขวด)</span>
                      <input type="number" placeholder="ราคา (บาท)" value={tempCalc.p1} onChange={(e) => setTempCalc({ ...tempCalc, p1: e.target.value })} className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white text-xs" />
                      <input type="number" placeholder="ปริมาณ (ml/กรัม)" value={tempCalc.v1} onChange={(e) => setTempCalc({ ...tempCalc, v1: e.target.value })} className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white text-xs" />
                      <p className="text-xs font-extrabold pt-1 dark:text-zinc-200">ตกหน่วยละ: {tempCalc.p1 && tempCalc.v1 ? (tempCalc.p1 / tempCalc.v1).toFixed(3) : '-'} บาท</p>
                    </div>
                    <div className="space-y-2 bg-slate-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-zinc-700/60">
                      <span className="font-bold text-blue-600 dark:text-blue-400">ตัวเลือก 2 (เช่น ถุงเติม)</span>
                      <input type="number" placeholder="ราคา (บาท)" value={tempCalc.p2} onChange={(e) => setTempCalc({ ...tempCalc, p2: e.target.value })} className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white text-xs" />
                      <input type="number" placeholder="ปริมาณ (ml/กรัม)" value={tempCalc.v2} onChange={(e) => setTempCalc({ ...tempCalc, v2: e.target.value })} className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white text-xs" />
                      <p className="text-xs font-extrabold pt-1 dark:text-zinc-200">ตกหน่วยละ: {tempCalc.p2 && tempCalc.v2 ? (tempCalc.p2 / tempCalc.v2).toFixed(3) : '-'} บาท</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= PAGE 3: ประวัติ & ถังขยะ ================= */}
        {mainTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-100">📜 ประวัติการใช้งานย้อนหลัง (สูงสุด 500 รายการ)</h3>
              {logs.length > 0 && (
                <button onClick={clearAllLogs} className="text-xs text-red-500 hover:underline font-bold">
                  ล้างประวัติทั้งหมด
                </button>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 space-y-3 text-xs shadow-xs">
              {logs.length === 0 ? <p className="text-slate-400 dark:text-zinc-500 text-center py-6">ยังไม่มีประวัติการใช้งาน</p> : logs.map(log => (
                <div key={log.id} className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2.5">
                  <div className="flex items-start gap-3">
                    <span className={`p-2 rounded-xl font-extrabold ${log.action_type === 'DEDUCT' ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'}`}>
                      {log.action_type === 'DEDUCT' ? '-' : '+'}{log.quantity_changed}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-zinc-100">{log.action_type === 'DEDUCT' ? 'นำออกไปใช้' : 'เติมของเข้าบ้าน'} ({log.quantity_changed} ชิ้น)</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{new Date(log.created_at).toLocaleString('th-TH')}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteSingleLog(log.id)} className="text-slate-300 dark:text-zinc-600 hover:text-red-500 p-1 transition">
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-amber-200/80 dark:border-amber-900/40 rounded-3xl p-4 space-y-2.5 shadow-xs">
              <h4 className="font-bold text-xs text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <Trash2 size={16} /> <span>🗑️ ถังขยะกู้คืนข้อมูล (คงไว้ 24 ชั่วโมง)</span>
              </h4>
              {trashItems.length === 0 ? <p className="text-xs text-slate-400 dark:text-zinc-500 py-2">ไม่มีรายการในถังขยะ</p> : trashItems.map(item => (
                <div key={item.id} className="bg-amber-50/50 dark:bg-zinc-800/80 p-3 rounded-2xl text-xs flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-zinc-100">{item.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-400">ลบเมื่อ: {new Date(item.deleted_at).toLocaleString('th-TH')}</p>
                  </div>
                  <button onClick={() => restoreProduct(item.id)} className="bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 active:scale-95 transition">
                    <RotateCcw size={12} /> กู้คืน
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* MODAL: รายละเอียดสินค้า */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto text-xs relative text-slate-800 dark:text-zinc-100">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 text-slate-400 dark:text-zinc-400 hover:text-slate-600"><X size={20} /></button>

            <div className="w-full h-52 bg-slate-100 dark:bg-zinc-800/80 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 dark:border-zinc-800/80">
              {selectedProduct.image_url ? <img src={selectedProduct.image_url} className="w-full h-full object-contain" /> : <Package size={48} className="text-slate-300 dark:text-zinc-600" />}
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">{selectedProduct.category} • {selectedProduct.size}</span>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mt-1">{selectedProduct.name}</h3>
              <p className="text-xs text-slate-400 dark:text-zinc-400">ยี่ห้อ: {selectedProduct.brand || 'ไม่ระบุ'} | ปริมาณ: {selectedProduct.volume || 'ไม่ระบุ'}</p>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">ราคาล่าสุด: {selectedProduct.price || 0} บาท ({selectedProduct.store || 'ไม่ระบุร้าน'})</p>
              <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">สต๊อกคงเหลือ: {selectedProduct.quantity} {selectedProduct.unit} (เกณฑ์ขั้นต่ำ {selectedProduct.min_threshold} {selectedProduct.unit})</p>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button onClick={() => togglePin(selectedProduct.id)} className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-1 font-bold transition ${selectedProduct.isPinned ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/50 dark:border-amber-900 dark:text-amber-400' : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300'}`}>
                <Pin size={14} /> {selectedProduct.isPinned ? 'ปักหมุดอยู่' : 'ปักหมุด'}
              </button>
              <button onClick={() => { setSelectedProduct(null); openAddModal(selectedProduct); }} className="flex-1 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-950/60 dark:border-emerald-900 dark:text-emerald-400 rounded-xl font-bold flex items-center justify-center gap-1 transition">
                <Edit3 size={14} /> แก้ไข
              </button>
              <button onClick={() => softDeleteProduct(selectedProduct.id, selectedProduct.name)} className="py-2.5 px-3 bg-red-50 border border-red-200 text-red-600 dark:bg-red-950/60 dark:border-red-900 dark:text-red-400 rounded-xl font-bold flex items-center justify-center transition">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: บันทึก/แก้ไขสินค้า */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto text-xs dark:text-zinc-100">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-2">
              <h3 className="font-bold text-sm">{editingId ? '✏️ แก้ไขข้อมูลสินค้า' : '📸 บันทึกของเข้าบ้าน'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 dark:text-zinc-400"><X size={20} /></button>
            </div>

            <div className="border-2 border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-3 text-center relative">
              <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              {imagePreview ? (
                <div className="h-32 w-full relative">
                  <img src={imagePreview} className="h-full mx-auto object-contain rounded-xl" />
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-1">กดเปลี่ยนรูปถ่ายใหม่ได้</p>
                </div>
              ) : (
                <>
                  <Camera size={24} className="mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">{aiProcessing ? '⚡ AI กำลังอ่านฉลาก...' : 'ถ่ายรูปหน้าซอง/ขวด (ให้ AI อ่านอัตโนมัติ)'}</span>
                </>
              )}
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-2.5">
              <div>
                <label className="block font-medium text-slate-500 dark:text-zinc-400 mb-0.5">ชื่อสินค้า *</label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" placeholder="เช่น น้ำยาล้างจาน" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-500 dark:text-zinc-400 mb-0.5">ยี่ห้อ</label>
                  <input type="text" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" placeholder="เช่น ซันไลต์" />
                </div>
                <div>
                  <label className="block font-medium text-slate-500 dark:text-zinc-400 mb-0.5">หมวดหมู่</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                    {categories.filter(c => c !== 'ทั้งหมด').map(c => <option key={c} value={c} className="dark:bg-zinc-800">{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-slate-500 dark:text-zinc-400 mb-0.5">ขนาด</label>
                  <select value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                    {sizes.map(s => <option key={s} value={s} className="dark:bg-zinc-800">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-500 dark:text-zinc-400 mb-0.5">หน่วยนับ</label>
                  <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                    {units.map(u => <option key={u} value={u} className="dark:bg-zinc-800">{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-500 dark:text-zinc-400 mb-0.5">ปริมาณ/ขวด</label>
                  <input type="text" value={formData.volume} onChange={(e) => setFormData({ ...formData, volume: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" placeholder="500ml" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-500 dark:text-zinc-400 mb-0.5">ราคาล่าสุด (บาท)</label>
                  <input type="number" value={formData.price} onFocus={(e) => e.target.select()} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white font-bold" />
                </div>
                <div>
                  <label className="block font-medium text-slate-500 dark:text-zinc-400 mb-0.5">ร้านค้าที่ซื้อ</label>
                  <input type="text" value={formData.store} onChange={(e) => setFormData({ ...formData, store: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" placeholder="เช่น CJ More" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-500 dark:text-zinc-400 mb-0.5">จำนวนที่ซื้อมา</label>
                  <input type="number" value={formData.quantity} onFocus={(e) => e.target.select()} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white font-bold" />
                </div>
                <div>
                  <label className="block font-medium text-slate-500 dark:text-zinc-400 mb-0.5">เกณฑ์เตือนขั้นต่ำ</label>
                  <input type="number" value={formData.min_threshold} onFocus={(e) => e.target.select()} onChange={(e) => setFormData({ ...formData, min_threshold: parseInt(e.target.value) || 1 })} className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="w-1/2 bg-slate-100 dark:bg-zinc-800 dark:text-zinc-300 py-2.5 rounded-xl font-medium">ยกเลิก</button>
                <button type="submit" className="w-1/2 bg-emerald-600 text-white py-2.5 rounded-xl font-medium shadow-md">บันทึกสต๊อก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: การตั้งค่า + จัดการตัวเลือก (เพิ่ม/แก้ไข/ลบ) */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto text-xs dark:text-zinc-100">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-2">
              <h3 className="font-bold text-sm flex items-center gap-1.5"><Settings size={16} /> การตั้งค่าระบบ</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 dark:text-zinc-400"><X size={20} /></button>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-500 dark:text-zinc-400">📊 ส่งออกรายงาน (ประทับวันเวลาให้อัตโนมัติ)</h4>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportToExcel} className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl font-semibold flex items-center justify-center gap-1.5">
                  <FileSpreadsheet size={16} /> ไฟล์ Excel
                </button>
                <button onClick={exportToPDF} className="p-2.5 bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-2xl font-semibold flex items-center justify-center gap-1.5">
                  <FileText size={16} /> รายงาน PDF
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <h4 className="font-bold text-slate-700 dark:text-zinc-300">✏️ จัดการตัวเลือก (เพิ่ม / แก้ไข / ลบ)</h4>
              
              <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setManageOptionType('category')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition ${manageOptionType === 'category' ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold' : 'text-slate-500 dark:text-zinc-400'}`}
                >
                  🏷️ หมวดหมู่
                </button>
                <button
                  onClick={() => setManageOptionType('size')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition ${manageOptionType === 'size' ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold' : 'text-slate-500 dark:text-zinc-400'}`}
                >
                  📏 ขนาด
                </button>
                <button
                  onClick={() => setManageOptionType('unit')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition ${manageOptionType === 'unit' ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold' : 'text-slate-500 dark:text-zinc-400'}`}
                >
                  📦 หน่วยนับ
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={`เพิ่ม${manageOptionType === 'category' ? 'หมวดหมู่' : manageOptionType === 'size' ? 'ขนาด' : 'หน่วยนับ'}ใหม่...`}
                  value={newOptionInput.value}
                  onChange={(e) => setNewOptionInput({ type: manageOptionType, value: e.target.value })}
                  className="flex-1 p-2 rounded-xl border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white text-xs"
                />
                <button onClick={handleAddCustomOption} className="bg-emerald-600 text-white px-3.5 rounded-xl font-bold text-xs">+ เพิ่ม</button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
                <p className="font-bold text-[10px] text-slate-400 dark:text-zinc-500">รายการที่มีอยู่ (กด ✏️ แก้ไข หรือ ✕ ลบ):</p>
                <div className="flex flex-wrap gap-1.5">
                  {(manageOptionType === 'category' ? categories : manageOptionType === 'size' ? sizes : units).map(item => (
                    <span key={item} className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 dark:border-zinc-700">
                      <span>{item}</span>
                      {item !== 'ทั้งหมด' && item !== 'อื่นๆ' && (
                        <div className="flex items-center gap-1 ml-1 border-l border-slate-200 dark:border-zinc-700 pl-1">
                          <button onClick={() => handleEditCustomOption(manageOptionType, item)} className="text-slate-400 hover:text-emerald-500 p-0.5"><Edit3 size={11} /></button>
                          <button onClick={() => handleDeleteCustomOption(manageOptionType, item)} className="text-slate-400 hover:text-red-500 font-bold p-0.5">✕</button>
                        </div>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar Glassmorphism */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-t border-slate-200/80 dark:border-zinc-800/80 py-2.5 z-30 shadow-lg">
        <div className="max-w-md mx-auto flex justify-around items-center text-[10px]">
          <button onClick={() => setMainTab('stock')} className={`flex flex-col items-center gap-1 transition ${mainTab === 'stock' ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105' : 'text-slate-400 dark:text-zinc-500'}`}>
            <HomeIcon size={20} /><span>สต๊อกบ้าน</span>
          </button>
          <button onClick={() => setMainTab('price')} className={`flex flex-col items-center gap-1 transition ${mainTab === 'price' ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105' : 'text-slate-400 dark:text-zinc-500'}`}>
            <Tag size={20} /><span>เช็กราคา & ซื้อของ</span>
          </button>
          <button onClick={() => setMainTab('history')} className={`flex flex-col items-center gap-1 transition ${mainTab === 'history' ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105' : 'text-slate-400 dark:text-zinc-500'}`}>
            <Clock size={20} /><span>ประวัติ & ถังขยะ</span>
          </button>
        </div>
      </nav>

    </div>
  );
}
