'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Plus, Minus, Search, Camera, AlertTriangle, Package, Trash2, X, Eye, Sparkles, Edit3, 
  Pin, Settings, Sun, Moon, FileSpreadsheet, FileText, ShoppingCart, RotateCcw, Home as HomeIcon, Tag, Clock,
  Grid, List, ChevronLeft, ChevronRight, Check
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

const DEFAULT_CATEGORIES = ['ทั้งหมด', 'ห้องครัวและของกิน', 'ห้องน้ำและทำความสะอาด', 'เครื่องสำอาง', 'อื่นๆ'];
const DEFAULT_UNITS = ['ขวด', 'ถุง', 'ก้อน', 'กล่อง', 'กระป๋อง', 'แพ็ค', 'ชิ้น', 'ซอง', 'เส้น'];
const DEFAULT_SIZES = ['เล็ก', 'กลาง', 'ใหญ่', 'ถุงเติม', 'ขวดใหญ่', 'จัมโบ้', 'ยาว'];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [trashItems, setTrashItems] = useState([]);
  const [logSelectMode, setLogSelectMode] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState([]);
  const [mainTab, setMainTab] = useState('stock');
  const [priceSubTab, setPriceSubTab] = useState('system');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('low_stock');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [activeCategory, setActiveCategory] = useState('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [quickCmd, setQuickCmd] = useState('');
  const [cmdProcessing, setCmdProcessing] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // Toast Notification State
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productLogs, setProductLogs] = useState([]);
  const [fullscreenImage, setFullscreenImage] = useState(null);
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
  const [cartCmd, setCartCmd] = useState('');
  const [cartCmdProcessing, setCartCmdProcessing] = useState(false);
  const [cartAddingId, setCartAddingId] = useState(null);

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
    fetchCustomOptions();
  }, []);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    purgeOldTrash();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 2500);
  };

  const purgeOldTrash = async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('products').delete().lt('deleted_at', twentyFourHoursAgo);
  };

  // ดึงตัวเลือกที่เซฟไว้ใน Supabase ออกมาแสดง
  const fetchCustomOptions = async () => {
    try {
      const { data } = await supabase.from('custom_options').select('*');
      if (data && data.length > 0) {
        const fetchedCats = data.filter(x => x.option_type === 'category').map(x => x.option_value);
        const fetchedUnits = data.filter(x => x.option_type === 'unit').map(x => x.option_value);
        const fetchedSizes = data.filter(x => x.option_type === 'size').map(x => x.option_value);

        if (fetchedCats.length > 0) setCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...fetchedCats])));
        if (fetchedUnits.length > 0) setUnits(Array.from(new Set([...DEFAULT_UNITS, ...fetchedUnits])));
        if (fetchedSizes.length > 0) setSizes(Array.from(new Set([...DEFAULT_SIZES, ...fetchedSizes])));
      }
    } catch (e) {
      console.log('fetchCustomOptions error:', e.message);
    }
  };

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

  const fetchProductLogs = async (productId) => {
    const { data } = await supabase.from('usage_logs').select('*').eq('product_id', productId).order('created_at', { ascending: false }).limit(50);
    if (data) setProductLogs(data);
  };

  const logAction = async (productId, productName, actionType, qtyChanged) => {
    await supabase.from('usage_logs').insert([{
      product_id: productId,
      product_name: productName || '',
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
    if (selectedProduct?.id === productId) fetchProductLogs(productId);
  };

  const deleteSingleLog = async (id) => {
    await supabase.from('usage_logs').delete().eq('id', id);
    setLogs(prev => prev.filter(l => l.id !== id));
    showToast('ลบประวัติรายการนี้เรียบร้อย');
  };

  const clearAllLogs = async () => {
    if (confirm('คุณต้องการล้างประวัติการใช้งานทั้งหมดใช่ไหม?')) {
      await supabase.from('usage_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      setLogs([]);
      showToast('🧹 ล้างประวัติทั้งหมดเรียบร้อยแล้ว');
    }
  };

  const toggleLogSelectMode = () => {
    setLogSelectMode(prev => !prev);
    setSelectedLogIds([]);
  };

  const toggleLogSelected = (id) => {
    setSelectedLogIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAllLogs = () => {
    setSelectedLogIds(prev => prev.length === logs.length ? [] : logs.map(l => l.id));
  };

  const deleteSelectedLogs = async () => {
    if (selectedLogIds.length === 0) return;
    if (confirm(`ลบประวัติที่เลือกไว้ ${selectedLogIds.length} รายการ ใช่ไหม?`)) {
      await supabase.from('usage_logs').delete().in('id', selectedLogIds);
      setLogs(prev => prev.filter(l => !selectedLogIds.includes(l.id)));
      showToast(`🗑️ ลบประวัติ ${selectedLogIds.length} รายการเรียบร้อย`);
      setSelectedLogIds([]);
      setLogSelectMode(false);
    }
  };

  const compressImage = (file, maxWidth = 500, quality = 0.6) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scaleFactor = Math.min(1, maxWidth / img.width);
          canvas.width = img.width * scaleFactor;
          canvas.height = img.height * scaleFactor;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/webp', quality));
        };
      };
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAiProcessing(true);
    try {
      const storageImage = await compressImage(file, 500, 0.6);
      setImagePreview(storageImage);
      setFormData((prev) => ({ ...prev, image_url: storageImage }));

      const aiImage = await compressImage(file, 1024, 0.85);
      const pureBase64 = aiImage.split(',')[1];

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
          showToast('✨ AI อ่านข้อมูลฉลากเรียบร้อย');
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
        showToast(`⚠️ AI สั่งงานไม่สำเร็จ (${aiData.error.message})`, 'error');
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
              msg.push(`เพิ่ม "${newItem.name}"`);
            }
          } else {
            const match = products.find(p => p.name.includes(cmd.target_name) || cmd.target_name.includes(p.name));
            if (match) {
              if (cmd.action === 'DEDUCT' || cmd.action === 'ADD') {
                const change = cmd.action === 'DEDUCT' ? -Math.abs(cmd.quantity || 1) : Math.abs(cmd.quantity || 1);
                await updateQuantity(match.id, match.quantity + change, match.name);
                msg.push(`${cmd.action === 'DEDUCT' ? 'ตัด' : 'เติม'} "${match.name}" ${Math.abs(change)} ${match.unit}`);
              } else if (cmd.action === 'DELETE') {
                await softDeleteProduct(match.id, match.name);
                msg.push(`ลบ "${match.name}"`);
              }
            }
          }
        }
        if (msg.length > 0) showToast(`✅ ${msg.join(', ')} เรียบร้อย`);
        setQuickCmd('');
      }
    } catch (err) {
      showToast('⚠️ เกิดข้อผิดพลาดในการประมวลผล', 'error');
    } finally {
      setCmdProcessing(false);
    }
  };

  const handleCartCommand = async (e) => {
    e.preventDefault();
    if (!cartCmd.trim()) return;

    setCartCmdProcessing(true);
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cart-command', prompt: cartCmd })
      });

      const aiData = await res.json();
      if (aiData.error) {
        showToast(`⚠️ AI ใส่ตะกร้าไม่สำเร็จ (${aiData.error.message})`, 'error');
        return;
      }

      const textResponse = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleanJsonStr.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        let cmds = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(cmds)) cmds = [cmds];

        let workingCart = [...cartItems];
        let msg = [];
        for (const cmd of cmds) {
          const price = parseFloat(cmd.price) || 0;
          const qty = Math.max(1, parseInt(cmd.qty) || 1);
          const name = cmd.name || 'สินค้าทั่วไป';
          if (cmd.action === 'UPDATE') {
            const idx = workingCart.findIndex(x => x.name.includes(name) || name.includes(x.name));
            if (idx >= 0) {
              workingCart[idx] = { ...workingCart[idx], price, qty };
              msg.push(`แก้ "${workingCart[idx].name}" เป็น x${qty} รวม ${price} บาท`);
            } else {
              workingCart.push({ id: Date.now() + Math.random(), name, price, qty });
              msg.push(`เพิ่ม "${name}" x${qty} รวม ${price} บาท`);
            }
          } else {
            workingCart.push({ id: Date.now() + Math.random(), name, price, qty });
            msg.push(`เพิ่ม "${name}" x${qty} รวม ${price} บาท`);
          }
        }
        setCartItems(workingCart);
        if (msg.length > 0) showToast(`🛒 ${msg.join(', ')} เรียบร้อย`);
        setCartCmd('');
      }
    } catch (err) {
      showToast('⚠️ เกิดข้อผิดพลาดในการประมวลผลตะกร้า', 'error');
    } finally {
      setCartCmdProcessing(false);
    }
  };

  const upsertProductToStock = async (name, qty, price) => {
    try {
      const existing = products.find(p => p.name.includes(name) || name.includes(p.name));
      if (existing) {
        const newQty = existing.quantity + qty;
        const { error } = await supabase.from('products').update({ quantity: newQty, price }).eq('id', existing.id);
        if (error) { showToast(`⚠️ เพิ่มสต๊อกไม่สำเร็จ: ${error.message}`, 'error'); return false; }
        setProducts(prev => prev.map(p => p.id === existing.id ? { ...p, quantity: newQty, price } : p));
        logAction(existing.id, existing.name, 'ADD', qty);
        showToast(`📦 เติม "${existing.name}" +${qty} ${existing.unit} เข้าสต๊อกเดิมเรียบร้อย`);
      } else {
        const newItem = {
          name, brand: '', category: 'อื่นๆ', unit: 'ชิ้น', size: 'กลาง',
          volume: '', quantity: qty, min_threshold: 1, price, store: ''
        };
        const { data, error } = await supabase.from('products').insert([newItem]).select();
        if (error) { showToast(`⚠️ เพิ่มสต๊อกไม่สำเร็จ: ${error.message}`, 'error'); return false; }
        if (data) {
          setProducts(prev => [data[0], ...prev]);
          logAction(data[0].id, data[0].name, 'CREATE', data[0].quantity);
          showToast(`📦 เพิ่ม "${name}" เป็นรายการสต๊อกใหม่เรียบร้อย`);
        }
      }
      return true;
    } catch (err) {
      showToast(`⚠️ เกิดข้อผิดพลาด: ${err.message}`, 'error');
      return false;
    }
  };

  const addCartItemToStock = async (item) => {
    if (!item.name || !item.name.trim()) return showToast('รายการนี้ยังไม่มีชื่อสินค้า', 'error');
    setCartAddingId(item.id);
    const qty = Math.max(1, parseInt(item.qty) || 1);
    await upsertProductToStock(item.name.trim(), qty, item.price);
    setCartAddingId(null);
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
    const newPin = !p.is_pinned;
    setProducts(prev => prev.map(item => item.id === id ? { ...item, is_pinned: newPin } : item));
    if (selectedProduct?.id === id) setSelectedProduct(prev => ({ ...prev, is_pinned: newPin }));
    await supabase.from('products').update({ is_pinned: newPin }).eq('id', id);
    showToast(newPin ? '📌 ปักหมุดรายการโปรดแล้ว' : 'ถอดปักหมุดแล้ว');
  };

  const softDeleteProduct = async (id, name) => {
    if (confirm(`ย้าย "${name}" ไปถังขยะกู้คืน 24 ชั่วโมง?`)) {
      const now = new Date().toISOString();
      await supabase.from('products').update({ deleted_at: now }).eq('id', id);
      setProducts(prev => prev.filter(x => x.id !== id));
      if (selectedProduct?.id === id) setSelectedProduct(null);
      fetchProducts();
      showToast(`🗑️ ย้าย "${name}" ไปถังขยะแล้ว`);
    }
  };

  const restoreProduct = async (id) => {
    await supabase.from('products').update({ deleted_at: null }).eq('id', id);
    fetchProducts();
    showToast('♻️ กู้คืนรายการสินค้าเรียบร้อย!');
  };

  const uploadImageIfNeeded = async (base64DataUrl) => {
    if (!base64DataUrl || !base64DataUrl.startsWith('data:')) return base64DataUrl;
    try {
      const res = await fetch(base64DataUrl);
      const blob = await res.blob();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, blob, { contentType: 'image/webp' });

      if (uploadError) {
        console.log('Upload failed, keeping base64 fallback:', uploadError.message);
        return base64DataUrl;
      }
      const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      return publicUrlData.publicUrl;
    } catch (err) {
      console.log('Upload threw an error, keeping base64 fallback:', err.message);
      return base64DataUrl;
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return showToast('กรุณากรอกชื่อสินค้า', 'error');

    try {
      const finalImageUrl = await uploadImageIfNeeded(formData.image_url);
      const dataToSave = { ...formData, image_url: finalImageUrl };

      if (editingId) {
        const { error } = await supabase.from('products').update(dataToSave).eq('id', editingId);
        if (error) {
          console.log('Update error:', error.message);
          return showToast(`⚠️ บันทึกไม่สำเร็จ: ${error.message}`, 'error');
        }
        setProducts(prev => prev.map(p => p.id === editingId ? { ...p, ...dataToSave } : p));
        if (selectedProduct?.id === editingId) setSelectedProduct({ ...selectedProduct, ...dataToSave });
        showToast('🎉 แก้ไขข้อมูลเรียบร้อย!');
      } else {
        const { data, error } = await supabase.from('products').insert([dataToSave]).select();
        if (error) {
          console.log('Insert error:', error.message);
          return showToast(`⚠️ บันทึกไม่สำเร็จ: ${error.message}`, 'error');
        }
        if (data) {
          setProducts([data[0], ...products]);
          logAction(data[0].id, data[0].name, 'CREATE', data[0].quantity);
          showToast('🎉 บันทึกของเข้าบ้านเรียบร้อย!');
        }
      }
      setShowAddModal(false);
    } catch (err) {
      console.log('handleSaveProduct threw:', err.message);
      showToast(`⚠️ เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
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

  const handleOpenDetailModal = (product) => {
    setSelectedProduct(product);
    fetchProductLogs(product.id);
  };

  // บันทึกตัวเลือกใหม่ลง Supabase ถาวร
  const handleAddCustomOption = async () => {
    const val = newOptionInput.value.trim();
    const type = manageOptionType;
    if (!val) return;

    const { error } = await supabase.from('custom_options').insert([{
      option_type: type,
      option_value: val
    }]);

    if (error) {
      showToast(`⚠️ เพิ่มตัวเลือกไม่สำเร็จ: ${error.message}`, 'error');
      return;
    }

    if (type === 'category' && !categories.includes(val)) setCategories([...categories, val]);
    if (type === 'unit' && !units.includes(val)) setUnits([...units, val]);
    if (type === 'size' && !sizes.includes(val)) setSizes([...sizes, val]);

    setNewOptionInput({ ...newOptionInput, value: '' });
    showToast('✅ เพิ่มตัวเลือกเซฟลงฐานข้อมูลเรียบร้อย');
  };

  // อัปเดตการแก้ไขตัวเลือกใน Supabase
  const handleEditCustomOption = async (type, oldVal) => {
    const newVal = prompt(`แก้ไขชื่อ${type === 'category' ? 'หมวดหมู่' : type === 'size' ? 'ขนาด' : 'หน่วยนับ'} "${oldVal}" เป็น:`, oldVal);
    if (!newVal || newVal.trim() === '' || newVal === oldVal) return;

    const trimmed = newVal.trim();

    await supabase.from('custom_options')
      .update({ option_value: trimmed })
      .eq('option_type', type)
      .eq('option_value', oldVal);

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
    showToast('🎉 แก้ไขชื่อเรียบร้อยแล้ว');
  };

  // ลบตัวเลือกออกจาก Supabase
  const handleDeleteCustomOption = async (type, itemToDelete) => {
    if (confirm(`คุณต้องการลบ "${itemToDelete}" ออกจากรายการตัวเลือกใช่ไหม?`)) {
      await supabase.from('custom_options')
        .delete()
        .eq('option_type', type)
        .eq('option_value', itemToDelete);

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
      showToast('🗑️ ลบตัวเลือกเรียบร้อยแล้ว');
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
    showToast('📊 ดาวน์โหลดไฟล์ Excel เรียบร้อย');
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

  let filteredProducts = products.filter(p => {
    const matchCat = activeCategory === 'ทั้งหมด' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  filteredProducts.sort((a, b) => {
    if (sortBy === 'low_stock') {
      const aLow = a.quantity <= a.min_threshold ? 1 : 0;
      const bLow = b.quantity <= b.min_threshold ? 1 : 0;
      return bLow - aLow;
    }
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'th');
    if (sortBy === 'qty_asc') return a.quantity - b.quantity;
    if (sortBy === 'qty_desc') return b.quantity - a.quantity;
    if (sortBy === 'price_asc') return (a.price || 0) - (b.price || 0);
    if (sortBy === 'price_desc') return (b.price || 0) - (a.price || 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const pinnedProducts = products.filter(p => p.is_pinned);

  const unitPrice1 = tempCalc.p1 && tempCalc.v1 ? parseFloat(tempCalc.p1) / parseFloat(tempCalc.v1) : null;
  const unitPrice2 = tempCalc.p2 && tempCalc.v2 ? parseFloat(tempCalc.p2) / parseFloat(tempCalc.v2) : null;
  let cheaperOption = null;
  let savingsPercent = 0;
  if (unitPrice1 !== null && unitPrice2 !== null && unitPrice1 !== unitPrice2) {
    cheaperOption = unitPrice1 < unitPrice2 ? 1 : 2;
    const higher = Math.max(unitPrice1, unitPrice2);
    const lower = Math.min(unitPrice1, unitPrice2);
    savingsPercent = higher > 0 ? Math.round(((higher - lower) / higher) * 100) : 0;
  }

  return (
    <div className={`min-h-screen pb-24 lg:pb-10 transition-colors duration-300 font-sans ${darkMode ? 'bg-ink-950 text-ink-100 dark' : 'bg-cream text-ink-800'}`}>
      
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-ink-900/90 dark:bg-ink-100/90 text-white dark:text-ink-900 border border-ink-700/50 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs animate-in fade-in slide-in-from-bottom duration-200">
          <Check size={16} className="text-clay-400 dark:text-clay-600" />
          <span className="font-semibold">{toast.message}</span>
          <button onClick={() => setToast({ show: false, message: '', type: 'success' })} className="ml-2 text-ink-400 hover:text-white dark:hover:text-ink-900"><X size={14} /></button>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-cream-50/85 dark:bg-ink-900/85 backdrop-blur-xl border-b border-gold-300/50 dark:border-gold-900/40 px-4 py-3 shadow-[0_1px_0_0_rgba(180,137,62,0.15)]">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button onClick={() => setMainTab('stock')} className="flex items-center gap-2.5 active:scale-95 transition text-left">
            <div className="w-9 h-9 bg-clay-500/10 dark:bg-clay-400/10 rounded-2xl flex items-center justify-center text-xl border border-clay-500/20">🏡</div>
            <div>
              <h1 className="font-display font-bold text-base tracking-tight bg-gradient-to-r from-clay-600 via-clay-500 to-honey-500 dark:from-clay-400 dark:to-honey-300 bg-clip-text text-transparent">Home Stock</h1>
              <p className="text-[10px] text-ink-400 dark:text-ink-500 font-medium">จัดการของใช้ในบ้านอัจฉริยะ</p>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-1 bg-ink-100/60 dark:bg-ink-800/60 rounded-2xl p-1">
            <button onClick={() => setMainTab('stock')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${mainTab === 'stock' ? 'bg-cream-50 dark:bg-ink-900 text-clay-600 dark:text-clay-400 shadow-sm' : 'text-ink-500 dark:text-ink-400'}`}>
              <HomeIcon size={16} /> สต๊อกบ้าน
            </button>
            <button onClick={() => setMainTab('price')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${mainTab === 'price' ? 'bg-cream-50 dark:bg-ink-900 text-clay-600 dark:text-clay-400 shadow-sm' : 'text-ink-500 dark:text-ink-400'}`}>
              <Tag size={16} /> เช็กราคา & ซื้อของ
            </button>
            <button onClick={() => setMainTab('history')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${mainTab === 'history' ? 'bg-cream-50 dark:bg-ink-900 text-clay-600 dark:text-clay-400 shadow-sm' : 'text-ink-500 dark:text-ink-400'}`}>
              <Clock size={16} /> ประวัติ & ถังขยะ
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-2xl bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:scale-105 active:scale-95 transition">
              {darkMode ? <Sun size={17} className="text-honey-400" /> : <Moon size={17} />}
            </button>
            <button onClick={() => setShowSettingsModal(true)} className="p-2.5 rounded-2xl bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:scale-105 active:scale-95 transition">
              <Settings size={17} />
            </button>
            <button onClick={() => openAddModal()} className="bg-gradient-to-r from-clay-600 to-clay-700 hover:from-clay-500 hover:to-clay-600 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl flex items-center gap-1.5 shadow-lg shadow-clay-900/25 ring-1 ring-gold-300/40 active:scale-95 transition">
              <Plus size={16} /> <span className="hidden sm:inline">เพิ่มของเข้าบ้าน</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-5">

        {/* PAGE 1: สต๊อกบ้าน */}
        {mainTab === 'stock' && (
          <div className="space-y-5">
            <form onSubmit={handleQuickCommand} className="bg-gradient-to-br from-clay-500/5 via-sage-500/5 to-transparent dark:from-clay-950/30 dark:via-ink-900 dark:to-ink-900 border border-clay-500/20 dark:border-ink-800 rounded-3xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-1.5 mb-2.5 text-xs font-bold text-clay-600 dark:text-clay-400">
                <Sparkles size={16} className="animate-pulse" />
                <span>AI พ่อบ้านอัจฉริยะ (แชทสั่งงานด้วยภาษาพูด)</span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="💬 พิมพ์แชทสั่ง เช่น 'ใช้น้ำยาล้างจาน 1 ถุง' หรือ 'เพิ่มสายชาร์จ 2 เมตร 150 บาท'..."
                  value={quickCmd}
                  onChange={(e) => setQuickCmd(e.target.value)}
                  className="w-full bg-cream-50/85 dark:bg-ink-800/80 border border-ink-200 dark:border-ink-700/60 rounded-2xl py-3 pl-4 pr-24 text-xs focus:ring-2 focus:ring-clay-500/30 focus:border-clay-500 focus:outline-none dark:text-ink-100 dark:placeholder-ink-500 shadow-inner"
                />
                <button type="submit" disabled={cmdProcessing} className="absolute right-1.5 bg-ink-900 dark:bg-clay-600 hover:bg-ink-800 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition active:scale-95 disabled:opacity-70">
                  {cmdProcessing ? 'กำลังสั่ง...' : 'สั่งงาน'}
                </button>
              </div>
            </form>

            {pinnedProducts.length > 0 && (
              <section className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink-700 dark:text-ink-300">
                  <span className="text-honey-500">⭐</span><span>ของใช้บ่อยประจำบ้าน (ปักหมุดไว้)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {pinnedProducts.map(item => (
                    <div key={item.id} className="relative bg-cream-50 dark:bg-ink-900/90 border border-honey-200/80 dark:border-honey-900/30 rounded-2xl p-3 pt-4 shadow-xs flex items-center gap-2.5 hover:border-honey-400 transition">
                      <span className="absolute -top-1.5 left-3 w-8 h-3.5 bg-honey-200/90 dark:bg-honey-800/70 rotate-[-4deg] rounded-[1px] shadow-sm" aria-hidden="true"></span>
                      <div onClick={() => handleOpenDetailModal(item)} className="w-10 h-10 bg-ink-100 dark:bg-ink-800 rounded-xl flex items-center justify-center flex-shrink-0 text-xl cursor-pointer overflow-hidden border border-ink-200/50 dark:border-ink-700/50">
                        {item.image_url ? <img src={item.image_url} className="w-full h-full object-contain" /> : '📦'}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-bold text-xs truncate dark:text-ink-100">{item.name}</h4>
                        <p className="text-[10px] text-ink-400 dark:text-ink-500 truncate">{item.brand} • {item.size}</p>
                      </div>
                      <div className="flex items-center gap-0.5 bg-ink-100 dark:bg-ink-800 p-1 rounded-xl">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.name)} className="w-5 h-5 flex items-center justify-center text-xs font-bold bg-cream-50 dark:bg-ink-700 dark:text-ink-100 rounded-lg shadow-xs active:scale-90 transition">-</button>
                        <span className="text-xs font-bold font-mono px-1.5 dark:text-ink-100">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.name)} className="w-5 h-5 flex items-center justify-center text-xs font-bold bg-cream-50 dark:bg-ink-700 dark:text-ink-100 rounded-lg shadow-xs active:scale-90 transition">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-3.5 text-ink-400 dark:text-ink-500" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อสินค้า, ยี่ห้อ หรือขนาด..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-2xl py-2.5 pl-11 pr-4 text-xs dark:text-ink-100 dark:placeholder-ink-500 shadow-xs focus:ring-2 focus:ring-clay-500/30 focus:border-clay-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-2xl px-3 py-2 text-xs font-medium dark:text-ink-200"
                  >
                    <option value="low_stock">⚠️ ของใกล้หมดขึ้นก่อน</option>
                    <option value="name">🔤 ชื่อสินค้า (ก-ฮ)</option>
                    <option value="qty_asc">🔢 จำนวน (น้อย ➔ มาก)</option>
                    <option value="qty_desc">🔢 จำนวน (มาก ➔ น้อย)</option>
                    <option value="price_asc">💰 ราคา (ถูก ➔ แพง)</option>
                    <option value="price_desc">💰 ราคา (แพง ➔ ถูก)</option>
                    <option value="updated">🕒 อัปเดตล่าสุด</option>
                  </select>

                  <div className="flex bg-ink-200/80 dark:bg-ink-800/80 p-1 rounded-2xl">
                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-xl transition ${viewMode === 'grid' ? 'bg-cream-50 dark:bg-ink-900 text-clay-600 dark:text-clay-400 shadow-xs' : 'text-ink-500'}`}>
                      <Grid size={16} />
                    </button>
                    <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-xl transition ${viewMode === 'list' ? 'bg-cream-50 dark:bg-ink-900 text-clay-600 dark:text-clay-400 shadow-xs' : 'text-ink-500'}`}>
                      <List size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div className="flex gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setCurrentPage(1); }}
                    className={`px-4 py-2 rounded-xl whitespace-nowrap transition font-medium text-xs ${activeCategory === cat ? 'bg-clay-600 text-white font-semibold shadow-sm' : 'bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800 text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Display */}
            {loading ? (
              <div className="text-center py-16 text-ink-400 dark:text-ink-500 text-xs">กำลังโหลดสต๊อก...</div>
            ) : paginatedProducts.length === 0 ? (
              <div className="text-center py-16 bg-cream-50 dark:bg-ink-900/60 rounded-3xl border border-dashed border-ink-200 dark:border-ink-800 text-ink-400 dark:text-ink-500 text-xs">ไม่พบรายการสินค้า</div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedProducts.map(item => {
                  const needsRefill = item.quantity <= item.min_threshold;
                  const refillDiff = item.min_threshold - item.quantity + 1;

                  return (
                    <div key={item.id} className="bg-cream-50 dark:bg-ink-900/90 border border-ink-200/80 dark:border-ink-800/80 rounded-3xl p-3.5 shadow-xs hover:shadow-md hover:border-clay-500/30 transition-all duration-200 flex gap-3.5 items-center relative overflow-hidden group">
                      <div onClick={() => handleOpenDetailModal(item)} className="w-18 h-18 max-w-[72px] max-h-[72px] bg-ink-100 dark:bg-ink-800/80 rounded-2xl flex-shrink-0 border border-ink-200/60 dark:border-ink-700/50 flex items-center justify-center cursor-pointer relative overflow-hidden group-hover:scale-102 transition">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-contain max-h-[72px]" />
                        ) : (
                          <Package size={26} className="text-ink-300 dark:text-ink-600" />
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition backdrop-blur-xs">
                          <Eye size={18} className="text-white" />
                        </div>
                      </div>

                      <div onClick={() => handleOpenDetailModal(item)} className="flex-grow min-w-0 cursor-pointer space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-clay-600 dark:text-clay-400 bg-clay-50 dark:bg-clay-950/60 border border-clay-500/10 dark:border-clay-500/20 px-2 py-0.5 rounded-lg truncate max-w-full">
                            {item.category} • {item.size}
                          </span>
                        </div>
                        <h3 className="font-bold text-xs text-ink-800 dark:text-ink-100 truncate">{item.name}</h3>
                        <p className="text-[11px] text-ink-400 dark:text-ink-400 truncate">
                          {item.brand ? `ยี่ห้อ: ${item.brand}` : 'ไม่ระบุยี่ห้อ'} {item.volume ? `(${item.volume})` : ''}
                        </p>
                        
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-[11px] text-clay-600 dark:text-clay-400 font-extrabold font-mono">{item.price || 0} บ. {item.store ? `• ${item.store}` : ''}</span>
                          {needsRefill && (
                            <span className="text-[9px] bg-red-50 dark:bg-red-950/60 border border-red-200/60 dark:border-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-md font-bold truncate">
                              ⚠️ +{refillDiff} {item.unit}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => togglePin(item.id)} className="p-1 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition">
                            <Pin size={14} className={item.is_pinned ? 'fill-honey-500 text-honey-500' : 'text-ink-300 dark:text-ink-600'} />
                          </button>
                          <button onClick={() => openAddModal(item)} className="p-1 text-ink-300 dark:text-ink-600 hover:text-clay-600 transition">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => softDeleteProduct(item.id, item.name)} className="p-1 text-ink-300 dark:text-ink-600 hover:text-red-500 transition">
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="flex items-center bg-ink-100 dark:bg-ink-800 border border-ink-200/80 dark:border-ink-700/60 rounded-xl p-1 shadow-inner">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.name)} className="w-6 h-6 flex items-center justify-center text-xs font-bold text-ink-600 dark:text-ink-300 hover:bg-cream-50 dark:hover:bg-ink-700 rounded-lg transition active:scale-90">-</button>
                          <input
                            type="number"
                            value={item.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0, item.name)}
                            className="w-9 text-center text-xs font-extrabold bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-md py-0.5 text-ink-900 dark:text-white shadow-xs"
                          />
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.name)} className="w-6 h-6 flex items-center justify-center text-xs font-bold text-ink-600 dark:text-ink-300 hover:bg-cream-50 dark:hover:bg-ink-700 rounded-lg transition active:scale-90">+</button>
                        </div>
                        <span className="text-[9px] text-ink-400 dark:text-ink-500 font-medium">ขั้นต่ำ: {item.min_threshold} {item.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW */
              <div className="bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-3xl p-3 divide-y divide-ink-100 dark:divide-ink-800 space-y-2">
                {paginatedProducts.map(item => (
                  <div key={item.id} className="pt-2 flex items-center justify-between gap-3 text-xs">
                    <div onClick={() => handleOpenDetailModal(item)} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                      <div className="w-10 h-10 bg-ink-100 dark:bg-ink-800 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-ink-200 dark:border-ink-700">
                        {item.image_url ? <img src={item.image_url} className="w-full h-full object-contain" /> : '📦'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold truncate text-ink-800 dark:text-ink-100">{item.name}</h4>
                        <p className="text-[10px] text-ink-400 truncate">{item.brand} • {item.size} • {item.category}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-bold text-clay-600 dark:text-clay-400 font-mono">{item.price || 0} บ.</span>
                      <div className="flex items-center bg-ink-100 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-xl p-0.5">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.name)} className="w-5 h-5 flex items-center justify-center font-bold text-xs">-</button>
                        <span className="w-6 text-center font-bold">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.name)} className="w-5 h-5 flex items-center justify-center font-bold text-xs">+</button>
                      </div>
                      <span className="text-[10px] text-ink-400 w-8">{item.unit}</span>
                      <button onClick={() => openAddModal(item)} className="p-1 text-ink-300 hover:text-clay-600"><Edit3 size={14} /></button>
                      <button onClick={() => softDeleteProduct(item.id, item.name)} className="p-1 text-ink-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-3xl p-3.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-ink-400">แสดงผล:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
                    className="bg-ink-100 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-xl px-2 py-1 font-bold"
                  >
                    <option value={20}>20 รายการ/หน้า</option>
                    <option value={50}>50 รายการ/หน้า</option>
                    <option value={100}>100 รายการ/หน้า</option>
                    <option value={200}>200 รายการ/หน้า</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 rounded-xl border border-ink-200 dark:border-ink-700 disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="font-bold text-ink-700 dark:text-ink-200">หน้า {currentPage} / {totalPages}</span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1.5 rounded-xl border border-ink-200 dark:border-ink-700 disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAGE 2: เช็กราคา & วางแผนซื้อ */}
        {mainTab === 'price' && (
          <div className="space-y-5">
            <div className="flex bg-ink-200/80 dark:bg-ink-800/80 p-1.5 rounded-2xl text-xs font-semibold">
              <button onClick={() => setPriceSubTab('system')} className={`flex-1 py-2.5 rounded-xl text-center transition ${priceSubTab === 'system' ? 'bg-cream-50 dark:bg-ink-900 text-clay-600 dark:text-clay-400 shadow-sm font-bold' : 'text-ink-500 dark:text-ink-400'}`}>
                🛒 รายการในระบบ & งบ
              </button>
              <button onClick={() => setPriceSubTab('temp')} className={`flex-1 py-2.5 rounded-xl text-center transition ${priceSubTab === 'temp' ? 'bg-cream-50 dark:bg-ink-900 text-clay-600 dark:text-clay-400 shadow-sm font-bold' : 'text-ink-500 dark:text-ink-400'}`}>
                🧮 เครื่องคิดเลข & ตะกร้าสด
              </button>
            </div>

            {priceSubTab === 'system' ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-clay-500/10 via-sage-500/10 to-transparent border border-clay-500/20 dark:border-clay-900/40 p-5 rounded-3xl shadow-xs">
                  <p className="text-xs text-clay-700 dark:text-clay-400 font-semibold">🛒 ยอดเงินรวมต้องเตรียมไปซื้อของ (ของใกล้หมด):</p>
                  <p className="text-3xl font-extrabold text-clay-800 dark:text-clay-300 mt-1 font-mono">{totalBudgetNeeded.toLocaleString()} <span className="text-base font-normal">บาท</span></p>

                  {lowStockItems.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-clay-500/20 dark:border-clay-900/40 space-y-1.5">
                      {lowStockItems.map(item => {
                        const needToBuy = Math.max(1, item.min_threshold - item.quantity + 1);
                        return (
                          <div key={item.id} className="flex justify-between items-center text-xs">
                            <span className="text-ink-700 dark:text-ink-200 truncate pr-2">⚠️ {item.name} <span className="text-ink-400">(เหลือ {item.quantity} {item.unit})</span></span>
                            <span className="font-mono font-bold text-clay-700 dark:text-clay-300 flex-shrink-0">+{needToBuy} {item.unit} • {(needToBuy * (item.price || 0)).toLocaleString()} บ.</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 pt-3 border-t border-clay-500/20 dark:border-clay-900/40 text-xs text-sage-600 dark:text-sage-400">✅ ของยังไม่ใกล้หมดสักรายการ ไม่ต้องซื้อเพิ่มตอนนี้</p>
                  )}
                </div>

                <div className="bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-3xl p-4 space-y-3 shadow-xs">
                  <h3 className="font-bold text-xs text-ink-800 dark:text-ink-100">เปรียบเทียบราคาสินค้าที่มีในระบบ</h3>
                  <div className="divide-y divide-ink-100 dark:divide-ink-800">
                    {products.map(p => (
                      <div key={p.id} className="py-2.5 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-bold text-ink-800 dark:text-ink-100">{p.name} ({p.brand || 'ไม่ระบุ'})</p>
                          <p className="text-[10px] text-ink-400 dark:text-ink-400">{p.size} • {p.volume || 'ไม่ระบุปริมาณ'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-clay-600 dark:text-clay-400 font-mono">{p.price || 0} บาท</p>
                          <p className="text-[10px] text-ink-400 dark:text-ink-400">ร้าน: {p.store || 'ไม่ระบุ'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* ปรับแก้ช่องตะกร้าคำนวณเงินสด ให้พอดีขอบมือถือแนวตั้ง 100% */}
                <div className="bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-3xl p-4 space-y-3.5 shadow-xs">
                  <h4 className="font-bold text-xs text-ink-800 dark:text-ink-100 flex items-center gap-1.5">
                    <ShoppingCart size={16} className="text-clay-600 dark:text-clay-400" />
                    <span>🛒 ตะกร้าคำนวณเงินสด (เช็กยอดเงินขณะเดินหยิบของ)</span>
                  </h4>
                  <p className="text-[10px] text-ink-400 dark:text-ink-500 -mt-2">ใส่จำนวน (x) แต่ละรายการ แล้วกด <Package size={10} className="inline text-clay-500" /> เพื่อเพิ่มรายการนั้นเข้าสต๊อกบ้านได้เลย</p>
                  
                  <form onSubmit={handleCartCommand} className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="✨ พิมพ์ให้ AI ใส่ตะกร้า เช่น 'นมข้นหวาน 25 บาท' หรือ 'แก้ราคานมข้นหวานเป็น 20'"
                      value={cartCmd}
                      onChange={(e) => setCartCmd(e.target.value)}
                      className="w-full bg-honey-50 dark:bg-honey-950/20 border border-honey-300/70 dark:border-honey-900/50 rounded-xl py-2.5 pl-3 pr-20 text-xs focus:ring-2 focus:ring-honey-400/40 focus:border-honey-500 focus:outline-none dark:text-ink-100 dark:placeholder-ink-500"
                    />
                    <button type="submit" disabled={cartCmdProcessing} className="absolute right-1.5 bg-honey-600 hover:bg-honey-700 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition active:scale-95 disabled:opacity-70">
                      {cartCmdProcessing ? '...' : 'AI ใส่ให้'}
                    </button>
                  </form>

                  <div className="flex items-center gap-2 text-[10px] text-ink-400 dark:text-ink-500">
                    <div className="flex-1 h-px bg-ink-200 dark:bg-ink-800"></div>
                    หรือใส่เองทีละช่อง
                    <div className="flex-1 h-px bg-ink-200 dark:bg-ink-800"></div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="ชื่อสินค้า"
                      value={cartName}
                      onChange={(e) => setCartName(e.target.value)}
                      className="flex-1 min-w-0 p-2.5 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-white text-xs"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="ราคา (บาท)"
                        value={cartPrice}
                        onChange={(e) => setCartPrice(e.target.value)}
                        className="w-1/2 sm:w-28 p-2.5 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-white text-xs font-bold"
                      />
                      <button onClick={() => {
                        if (!cartPrice) return;
                        setCartItems([...cartItems, { id: Date.now(), name: cartName || 'สินค้าทั่วไป', price: parseFloat(cartPrice), qty: 1 }]);
                        setCartName(''); setCartPrice('');
                      }} className="w-1/2 sm:w-auto bg-clay-600 text-white text-xs px-4 py-2.5 rounded-xl font-bold active:scale-95 transition whitespace-nowrap">+ ใส่ตะกร้า</button>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-ink-100 dark:border-ink-800">
                    {cartItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center bg-ink-50 dark:bg-ink-800/80 p-2 rounded-xl text-xs dark:text-ink-200 gap-2">
                        <span className="truncate flex-1 min-w-0">{item.name}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] text-ink-400">x</span>
                          <input
                            type="number"
                            min="1"
                            value={item.qty || 1}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setCartItems(cartItems.map(x => x.id === item.id ? { ...x, qty: parseInt(e.target.value) || 1 } : x))}
                            className="w-10 text-center bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg py-0.5 font-bold"
                          />
                        </div>
                        <div className="flex items-center gap-2 font-bold flex-shrink-0">
                          <span className="font-mono">{item.price} บาท</span>
                          <button
                            onClick={() => addCartItemToStock(item)}
                            disabled={cartAddingId === item.id}
                            title="เพิ่มรายการนี้เข้าสต๊อกบ้าน"
                            className="text-clay-600 dark:text-clay-400 hover:text-clay-800 disabled:opacity-40 p-1"
                          >
                            <Package size={14} />
                          </button>
                          <button onClick={() => setCartItems(cartItems.filter(x => x.id !== item.id))} className="text-red-500 font-bold px-1">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-ink-200 dark:border-ink-700 font-bold">
                    <span className="text-xs dark:text-ink-200">ยอดรวมขณะนี้:</span>
                    <span className="text-xl text-clay-600 dark:text-clay-400 font-extrabold font-mono">{cartItems.reduce((sum, item) => sum + item.price, 0)} บาท</span>
                  </div>
                </div>

                {/* เครื่องคิดเลขเทียบราคา เรียงแนวนอน/แนวตั้ง นุ่มนวล */}
                <div className="bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-3xl p-4 space-y-3.5 shadow-xs">
                  <h4 className="font-bold text-xs text-ink-800 dark:text-ink-100">⚖️ เครื่องคิดเลขเปรียบเทียบราคาเฉลี่ยต่อหน่วย</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className={`space-y-2 p-3.5 rounded-2xl border transition ${cheaperOption === 1 ? 'bg-sage-50 dark:bg-sage-950/40 border-sage-400 dark:border-sage-700 ring-2 ring-sage-400/40' : 'bg-ink-50 dark:bg-ink-800/50 border-ink-200/60 dark:border-ink-700/60'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-clay-600 dark:text-clay-400 font-mono">ตัวเลือก 1 (เช่น ขวด)</span>
                        {cheaperOption === 1 && <span className="text-[9px] bg-sage-600 text-white px-1.5 py-0.5 rounded-md font-bold">🏆 คุ้มกว่า {savingsPercent}%</span>}
                      </div>
                      <input type="number" placeholder="ราคา (บาท)" value={tempCalc.p1} onChange={(e) => setTempCalc({ ...tempCalc, p1: e.target.value })} className="w-full p-2 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-900 dark:text-white text-xs" />
                      <input type="number" placeholder="ปริมาณ (ml/กรัม)" value={tempCalc.v1} onChange={(e) => setTempCalc({ ...tempCalc, v1: e.target.value })} className="w-full p-2 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-900 dark:text-white text-xs" />
                      <p className="text-xs font-extrabold pt-1 dark:text-ink-200 font-mono">ตกหน่วยละ: {unitPrice1 !== null ? unitPrice1.toFixed(3) : '-'} บาท</p>
                    </div>
                    <div className={`space-y-2 p-3.5 rounded-2xl border transition ${cheaperOption === 2 ? 'bg-sage-50 dark:bg-sage-950/40 border-sage-400 dark:border-sage-700 ring-2 ring-sage-400/40' : 'bg-ink-50 dark:bg-ink-800/50 border-ink-200/60 dark:border-ink-700/60'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sage-600 dark:text-sage-400">ตัวเลือก 2 (เช่น ถุงเติม)</span>
                        {cheaperOption === 2 && <span className="text-[9px] bg-sage-600 text-white px-1.5 py-0.5 rounded-md font-bold">🏆 คุ้มกว่า {savingsPercent}%</span>}
                      </div>
                      <input type="number" placeholder="ราคา (บาท)" value={tempCalc.p2} onChange={(e) => setTempCalc({ ...tempCalc, p2: e.target.value })} className="w-full p-2 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-900 dark:text-white text-xs" />
                      <input type="number" placeholder="ปริมาณ (ml/กรัม)" value={tempCalc.v2} onChange={(e) => setTempCalc({ ...tempCalc, v2: e.target.value })} className="w-full p-2 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-900 dark:text-white text-xs" />
                      <p className="text-xs font-extrabold pt-1 dark:text-ink-200 font-mono">ตกหน่วยละ: {unitPrice2 !== null ? unitPrice2.toFixed(3) : '-'} บาท</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAGE 3: ประวัติ & ถังขยะ */}
        {mainTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-2">
              <h3 className="font-display font-bold text-sm text-ink-800 dark:text-ink-100">📜 ประวัติการใช้งานย้อนหลัง (สูงสุด 500 รายการ)</h3>
              {logs.length > 0 && (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button onClick={toggleLogSelectMode} className="text-xs text-clay-600 dark:text-clay-400 hover:underline font-bold whitespace-nowrap">
                    {logSelectMode ? 'ยกเลิกเลือก' : 'เลือกหลายรายการ'}
                  </button>
                  <button onClick={clearAllLogs} className="text-xs text-red-500 hover:underline font-bold whitespace-nowrap">
                    ล้างประวัติทั้งหมด
                  </button>
                </div>
              )}
            </div>

            {logSelectMode && logs.length > 0 && (
              <div className="flex items-center justify-between bg-clay-50 dark:bg-clay-950/40 border border-clay-200 dark:border-clay-900/40 rounded-2xl p-3 text-xs">
                <button onClick={toggleSelectAllLogs} className="font-bold text-clay-700 dark:text-clay-300">
                  {selectedLogIds.length === logs.length ? '☑ ยกเลิกเลือกทั้งหมด' : '☐ เลือกทั้งหมด'} ({selectedLogIds.length}/{logs.length})
                </button>
                <button
                  onClick={deleteSelectedLogs}
                  disabled={selectedLogIds.length === 0}
                  className="bg-red-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-1"
                >
                  <Trash2 size={12} /> ลบที่เลือก ({selectedLogIds.length})
                </button>
              </div>
            )}

            <div className="bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-3xl p-4 space-y-3 text-xs shadow-xs">
              {logs.length === 0 ? <p className="text-ink-400 dark:text-ink-500 text-center py-6">ยังไม่มีประวัติการใช้งาน</p> : logs.map(log => (
                <div key={log.id} className="flex items-center justify-between border-b border-ink-100 dark:border-ink-800 pb-2.5">
                  <div className="flex items-center gap-3">
                    {logSelectMode && (
                      <input
                        type="checkbox"
                        checked={selectedLogIds.includes(log.id)}
                        onChange={() => toggleLogSelected(log.id)}
                        className="w-4 h-4 accent-clay-600 flex-shrink-0"
                      />
                    )}
                    <span className={`p-2 rounded-xl font-extrabold font-mono ${log.action_type === 'DEDUCT' ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400' : 'bg-clay-50 text-clay-600 dark:bg-clay-950/60 dark:text-clay-400'}`}>
                      {log.action_type === 'DEDUCT' ? '-' : '+'}{log.quantity_changed}
                    </span>
                    <div>
                      <p className="font-bold text-ink-800 dark:text-ink-100">{log.product_name ? log.product_name : (log.action_type === 'DEDUCT' ? 'นำออกไปใช้' : 'เติมของเข้าบ้าน')}</p>
                      <p className="text-[10px] text-ink-500 dark:text-ink-400">{log.action_type === 'DEDUCT' ? 'นำออกไปใช้' : 'เติมของเข้าบ้าน'} {log.quantity_changed} ชิ้น</p>
                      <p className="text-[10px] text-ink-400 dark:text-ink-500">{new Date(log.created_at).toLocaleString('th-TH')}</p>
                    </div>
                  </div>
                  {!logSelectMode && (
                    <button onClick={() => deleteSingleLog(log.id)} className="text-ink-300 dark:text-ink-600 hover:text-red-500 p-1 transition">
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-cream-50 dark:bg-ink-900 border border-honey-200/80 dark:border-honey-900/40 rounded-3xl p-4 space-y-2.5 shadow-xs">
              <h4 className="font-bold text-xs text-honey-800 dark:text-honey-400 flex items-center gap-1.5">
                <Trash2 size={16} /> <span>🗑️ ถังขยะกู้คืนข้อมูล (คงไว้ 24 ชั่วโมง)</span>
              </h4>
              {trashItems.length === 0 ? <p className="text-xs text-ink-400 dark:text-ink-500 py-2">ไม่มีรายการในถังขยะ</p> : trashItems.map(item => (
                <div key={item.id} className="bg-honey-50/50 dark:bg-ink-800/80 p-3 rounded-2xl text-xs flex justify-between items-center">
                  <div>
                    <p className="font-bold text-ink-800 dark:text-ink-100">{item.name}</p>
                    <p className="text-[10px] text-ink-400 dark:text-ink-400">ลบเมื่อ: {new Date(item.deleted_at).toLocaleString('th-TH')}</p>
                  </div>
                  <button onClick={() => restoreProduct(item.id)} className="bg-clay-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 active:scale-95 transition">
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
          <div className="bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto text-xs relative text-ink-800 dark:text-ink-100">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 text-ink-400 dark:text-ink-400 hover:text-ink-600"><X size={20} /></button>

            <div 
              onClick={() => selectedProduct.image_url && setFullscreenImage(selectedProduct.image_url)} 
              className="w-full h-52 bg-ink-100 dark:bg-ink-800/80 rounded-2xl flex items-center justify-center overflow-hidden border border-ink-100 dark:border-ink-800/80 cursor-pointer relative group"
            >
              {selectedProduct.image_url ? (
                <>
                  <img src={selectedProduct.image_url} className="w-full h-full object-contain max-h-52" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition backdrop-blur-xs">
                    <span className="text-white text-xs font-bold bg-black/50 px-3 py-1.5 rounded-xl">🔍 แตะเพื่อขยายรูปเต็มจอ</span>
                  </div>
                </>
              ) : (
                <Package size={48} className="text-ink-300 dark:text-ink-600" />
              )}
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-clay-600 dark:text-clay-400 bg-clay-50 dark:bg-clay-950/60 px-2 py-0.5 rounded-md">{selectedProduct.category} • {selectedProduct.size}</span>
              <h3 className="text-base font-bold text-ink-900 dark:text-ink-100 mt-1">{selectedProduct.name}</h3>
              <p className="text-xs text-ink-400 dark:text-ink-400">ยี่ห้อ: {selectedProduct.brand || 'ไม่ระบุ'} | ปริมาณ: {selectedProduct.volume || 'ไม่ระบุ'}</p>
              <p className="text-xs font-bold text-clay-600 dark:text-clay-400">ราคาล่าสุด: {selectedProduct.price || 0} บาท ({selectedProduct.store || 'ไม่ระบุร้าน'})</p>
              
              <div className="flex items-center justify-between pt-2 border-t border-ink-100 dark:border-ink-800">
                <span className="font-bold text-ink-700 dark:text-ink-300">จำนวนสต๊อก:</span>
                <div className="flex items-center bg-ink-100 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-xl p-1">
                  <button onClick={() => updateQuantity(selectedProduct.id, selectedProduct.quantity - 1, selectedProduct.name)} className="w-7 h-7 flex items-center justify-center font-bold text-sm bg-cream-50 dark:bg-ink-700 rounded-lg shadow-xs">-</button>
                  <input
                    type="number"
                    value={selectedProduct.quantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateQuantity(selectedProduct.id, parseInt(e.target.value) || 0, selectedProduct.name)}
                    className="w-12 text-center font-bold text-sm bg-transparent dark:text-white"
                  />
                  <button onClick={() => updateQuantity(selectedProduct.id, selectedProduct.quantity + 1, selectedProduct.name)} className="w-7 h-7 flex items-center justify-center font-bold text-sm bg-cream-50 dark:bg-ink-700 rounded-lg shadow-xs">+</button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-ink-100 dark:border-ink-800">
              <button onClick={() => togglePin(selectedProduct.id)} className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-1 font-bold transition ${selectedProduct.is_pinned ? 'bg-honey-50 border-honey-200 text-honey-600 dark:bg-honey-950/50 dark:border-honey-900 dark:text-honey-400' : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300'}`}>
                <Pin size={14} /> {selectedProduct.is_pinned ? 'ปักหมุดอยู่' : 'ปักหมุด'}
              </button>
              <button onClick={() => { setSelectedProduct(null); openAddModal(selectedProduct); }} className="flex-1 py-2.5 bg-clay-50 border border-clay-200 text-clay-600 dark:bg-clay-950/60 dark:border-clay-900 dark:text-clay-400 rounded-xl font-bold flex items-center justify-center gap-1 transition">
                <Edit3 size={14} /> แก้ไข
              </button>
              <button onClick={() => softDeleteProduct(selectedProduct.id, selectedProduct.name)} className="py-2.5 px-3 bg-red-50 border border-red-200 text-red-600 dark:bg-red-950/60 dark:border-red-900 dark:text-red-400 rounded-xl font-bold flex items-center justify-center transition">
                <Trash2 size={14} />
              </button>
            </div>

            <div className="pt-3 border-t border-ink-100 dark:border-ink-800 space-y-2">
              <h4 className="font-bold text-ink-700 dark:text-ink-300 flex items-center gap-1">
                <Clock size={14} /> <span>ประวัติย้อนหลังเฉพาะสินค้านี้</span>
              </h4>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                {productLogs.length === 0 ? <p className="text-ink-400 text-center py-2">ยังไม่มีประวัติเคลื่อนไหว</p> : productLogs.map(log => (
                  <div key={log.id} className="flex justify-between items-center bg-ink-50 dark:bg-ink-800/60 p-2 rounded-xl">
                    <span className={`font-bold ${log.action_type === 'DEDUCT' ? 'text-red-500' : 'text-clay-500'}`}>
                      {log.action_type === 'DEDUCT' ? 'นำออกใช้' : 'เติมเข้าบ้าน'} ({log.quantity_changed} {selectedProduct.unit})
                    </span>
                    <span className="text-ink-400 text-[10px]">{new Date(log.created_at).toLocaleString('th-TH')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX: รูปภาพขยายใหญ่เต็มหน้าจอ 100% */}
      {fullscreenImage && (
        <div onClick={() => setFullscreenImage(null)} className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md cursor-pointer animate-in fade-in duration-200">
          <button onClick={() => setFullscreenImage(null)} className="absolute top-4 right-4 bg-ink-800/80 text-white p-2 rounded-full hover:bg-ink-700"><X size={24} /></button>
          <img src={fullscreenImage} alt="Fullscreen View" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
        </div>
      )}

      {/* MODAL: บันทึก/แก้ไขสินค้า */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto text-xs dark:text-ink-100">
            <div className="flex justify-between items-center border-b border-ink-100 dark:border-ink-800 pb-2">
              <h3 className="font-display font-bold text-sm">{editingId ? '✏️ แก้ไขข้อมูลสินค้า' : '📸 บันทึกของเข้าบ้าน'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-ink-400 dark:text-ink-400"><X size={20} /></button>
            </div>

            <div className="border-2 border-dashed border-clay-300 dark:border-clay-800 bg-clay-50/50 dark:bg-clay-950/20 rounded-2xl p-3 text-center relative">
              <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              {imagePreview ? (
                <div className="h-32 w-full relative">
                  <img src={imagePreview} className="h-full mx-auto object-contain rounded-xl max-h-32" />
                  <p className="text-[10px] text-clay-700 dark:text-clay-400 font-bold mt-1">กดเปลี่ยนรูปถ่ายใหม่ได้</p>
                </div>
              ) : (
                <>
                  <Camera size={24} className="mx-auto text-clay-600 dark:text-clay-400 mb-1" />
                  <span className="text-[11px] font-semibold text-clay-700 dark:text-clay-400 block">{aiProcessing ? '⚡ AI กำลังอ่านฉลาก...' : 'ถ่ายรูปหน้าซอง/ขวด (ให้ AI อ่านอัตโนมัติ)'}</span>
                </>
              )}
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-2.5">
              <div>
                <label className="block font-medium text-ink-500 dark:text-ink-400 mb-0.5">ชื่อสินค้า *</label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-white" placeholder="เช่น น้ำยาล้างจาน" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-ink-500 dark:text-ink-400 mb-0.5">ยี่ห้อ</label>
                  <input type="text" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="w-full p-2.5 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-white" placeholder="เช่น ซันไลต์" />
                </div>
                <div>
                  <label className="block font-medium text-ink-500 dark:text-ink-400 mb-0.5">หมวดหมู่</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full p-2.5 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-white">
                    {categories.filter(c => c !== 'ทั้งหมด').map(c => <option key={c} value={c} className="dark:bg-ink-800">{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-ink-500 dark:text-ink-400 mb-0.5">ขนาด</label>
                  <select value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} className="w-full p-2.5 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-white">
                    {sizes.map(s => <option key={s} value={s} className="dark:bg-ink-800">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-ink-500 dark:text-ink-400 mb-0.5">หน่วยนับ</label>
                  <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full p-2.5 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-white">
                    {units.map(u => <option key={u} value={u} className="dark:bg-ink-800">{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-ink-500 dark:text-ink-400 mb-0.5">ปริมาณ/ขวด</label>
                  <input type="text" value={formData.volume} onChange={(e) => setFormData({ ...formData, volume: e.target.value })} className="w-full p-2.5 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-white" placeholder="500ml" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-ink-500 dark:text-ink-400 mb-0.5">ราคาล่าสุด (บาท)</label>
                  <input type="number" value={formData.price} onFocus={(e) => e.target.select()} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} className="w-full p-2.5 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-white font-bold" />
                </div>
                <div>
                  <label className="block font-medium text-ink-500 dark:text-ink-400 mb-0.5">ร้านค้าที่ซื้อ</label>
                  <input type="text" value={formData.store} onChange={(e) => setFormData({ ...formData, store: e.target.value })} className="w-full p-2.5 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-white" placeholder="เช่น CJ More" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-ink-500 dark:text-ink-400 mb-0.5">จำนวนที่ซื้อมา</label>
                  <input type="number" value={formData.quantity} onFocus={(e) => e.target.select()} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} className="w-full p-2.5 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-white font-bold" />
                </div>
                <div>
                  <label className="block font-medium text-slate-500 dark:text-zinc-400 mb-0.5">เกณฑ์เตือนขั้นต่ำ</label>
                  <input type="number" value={formData.min_threshold} onFocus={(e) => e.target.select()} onChange={(e) => setFormData({ ...formData, min_threshold: parseInt(e.target.value) || 1 })} className="w-full p-2.5 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-white" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="w-1/2 bg-ink-100 dark:bg-ink-800 dark:text-ink-300 py-2.5 rounded-xl font-medium">ยกเลิก</button>
                <button type="submit" className="w-1/2 bg-clay-600 text-white py-2.5 rounded-xl font-medium shadow-md">บันทึกสต๊อก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: การตั้งค่า */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-cream-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto text-xs dark:text-ink-100">
            <div className="flex justify-between items-center border-b border-ink-100 dark:border-ink-800 pb-2">
              <h3 className="font-display font-bold text-sm flex items-center gap-1.5"><Settings size={16} /> การตั้งค่าระบบ</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-ink-400 dark:text-ink-400"><X size={20} /></button>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-ink-500 dark:text-ink-400">📊 ส่งออกรายงาน (ประทับวันเวลาให้อัตโนมัติ)</h4>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportToExcel} className="p-2.5 bg-clay-50 text-clay-700 dark:bg-clay-950/60 dark:text-clay-400 border border-clay-200 dark:border-clay-900/40 rounded-2xl font-semibold flex items-center justify-center gap-1.5">
                  <FileSpreadsheet size={16} /> ไฟล์ Excel
                </button>
                <button onClick={exportToPDF} className="p-2.5 bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-2xl font-semibold flex items-center justify-center gap-1.5">
                  <FileText size={16} /> รายงาน PDF
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-ink-100 dark:border-ink-800">
              <h4 className="font-bold text-ink-700 dark:text-ink-300">✏️ จัดการตัวเลือก (เพิ่ม / แก้ไข / ลบ)</h4>
              
              <div className="flex gap-1 bg-ink-100 dark:bg-ink-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setManageOptionType('category')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition ${manageOptionType === 'category' ? 'bg-cream-50 dark:bg-ink-900 text-clay-600 dark:text-clay-400 shadow-xs font-bold' : 'text-ink-500 dark:text-ink-400'}`}
                >
                  🏷️ หมวดหมู่
                </button>
                <button
                  onClick={() => setManageOptionType('size')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition ${manageOptionType === 'size' ? 'bg-cream-50 dark:bg-ink-900 text-clay-600 dark:text-clay-400 shadow-xs font-bold' : 'text-ink-500 dark:text-ink-400'}`}
                >
                  📏 ขนาด
                </button>
                <button
                  onClick={() => setManageOptionType('unit')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition ${manageOptionType === 'unit' ? 'bg-cream-50 dark:bg-ink-900 text-clay-600 dark:text-clay-400 shadow-xs font-bold' : 'text-ink-500 dark:text-ink-400'}`}
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
                  className="flex-1 p-2 rounded-xl border border-ink-200 dark:border-ink-700 dark:bg-ink-800 dark:text-white text-xs"
                />
                <button onClick={handleAddCustomOption} className="bg-clay-600 text-white px-3.5 rounded-xl font-bold text-xs">+ เพิ่ม</button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
                <p className="font-bold text-[10px] text-ink-400 dark:text-ink-500">รายการที่มีอยู่ (กด ✏️ แก้ไข หรือ ✕ ลบ):</p>
                <div className="flex flex-wrap gap-1.5">
                  {(manageOptionType === 'category' ? categories : manageOptionType === 'size' ? sizes : units).map(item => (
                    <span key={item} className="bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 border border-ink-200 dark:border-ink-700">
                      <span>{item}</span>
                      {item !== 'ทั้งหมด' && item !== 'อื่นๆ' && (
                        <div className="flex items-center gap-1 ml-1 border-l border-ink-200 dark:border-ink-700 pl-1">
                          <button onClick={() => handleEditCustomOption(manageOptionType, item)} className="text-ink-400 hover:text-clay-500 p-0.5"><Edit3 size={11} /></button>
                          <button onClick={() => handleDeleteCustomOption(manageOptionType, item)} className="text-ink-400 hover:text-red-500 font-bold p-0.5">✕</button>
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

      {/* Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-cream-50/85 dark:bg-ink-900/85 backdrop-blur-xl border-t border-gold-300/50 dark:border-gold-900/40 py-2.5 z-30 shadow-[0_-1px_0_0_rgba(180,137,62,0.15)]">
        <div className="max-w-md mx-auto flex justify-around items-center text-[10px]">
          <button onClick={() => setMainTab('stock')} className={`flex flex-col items-center gap-1 transition ${mainTab === 'stock' ? 'text-clay-600 dark:text-clay-400 font-bold scale-105' : 'text-ink-400 dark:text-ink-500'}`}>
            <HomeIcon size={20} /><span>สต๊อกบ้าน</span>
          </button>
          <button onClick={() => setMainTab('price')} className={`flex flex-col items-center gap-1 transition ${mainTab === 'price' ? 'text-clay-600 dark:text-clay-400 font-bold scale-105' : 'text-ink-400 dark:text-ink-500'}`}>
            <Tag size={20} /><span>เช็กราคา & ซื้อของ</span>
          </button>
          <button onClick={() => setMainTab('history')} className={`flex flex-col items-center gap-1 transition ${mainTab === 'history' ? 'text-clay-600 dark:text-clay-400 font-bold scale-105' : 'text-ink-400 dark:text-ink-500'}`}>
            <Clock size={20} /><span>ประวัติ & ถังขยะ</span>
          </button>
        </div>
      </nav>

    </div>
  );
}
