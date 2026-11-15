import { put, list, del } from '@vercel/blob';

const DATA_FILE = 'sharjah/store-data.json';
const FALLBACK_ADMIN_PASS = process.env.ADMIN_PASSWORD || 'cc7895236';

const defaultData = {
  adminPassword: '',
  products: [],
  categories: ['الأدوية', 'عناية الطفل', 'الجمال', 'العروض', 'العناية بالمرأة', 'العطور'],
  categoryArt: {},
  subcategories: {},
  bankAccounts: [],
  banners: [],
  settings: {
    brand: 'صيدلية الشارقة',
    logo: '',
    bgColor: '#f3f5f9',
    address: '',
    phone: '',
    whatsappEnabled: false,
  },
  customers: [],
  orders: [],
};

async function readStore() {
  const { blobs } = await list({ prefix: DATA_FILE });
  if (!blobs.length) return { ...defaultData };
  const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
  const res = await fetch(`${latest.url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return { ...defaultData };
  return { ...defaultData, ...(await res.json()) };
}

async function writeStore(data) {
  await put(DATA_FILE, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
}

function getActiveAdminPass(store) {
  return (store.adminPassword && store.adminPassword.trim()) ? store.adminPassword.trim() : FALLBACK_ADMIN_PASS;
}

function getUsedImageUrls(store) {
  const used = new Set();
  if (store.settings?.logo) used.add(store.settings.logo);

  (store.products || []).forEach(p => { if (p.image) used.add(p.image); });
  Object.values(store.categoryArt || {}).forEach(url => { if (url) used.add(url); });
  Object.values(store.subcategories || {}).forEach(list => {
    (list || []).forEach(s => { if (s.image) used.add(s.image); });
  });
  (store.banners || []).forEach(b => { if (b.image) used.add(b.image); });
  (store.orders || []).forEach(o => { if (o.proof) used.add(o.proof); });

  return used;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    if (req.method === 'GET') {
      const store = await readStore();
      const { adminPassword, ...publicStore } = store;
      const safeCustomers = (store.customers || []).map(({ password, ...rest }) => rest);
      return res.status(200).json({ ...publicStore, customers: safeCustomers });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { action, password, payload } = body;
    const store = await readStore();
    const activePass = getActiveAdminPass(store);

    if (action === 'admin_login') {
      if (password !== activePass) return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
      const { adminPassword, ...safeStore } = store;
      return res.status(200).json({ ok: true, store: safeStore });
    }

    if (action === 'admin_save') {
      if (password !== activePass) return res.status(401).json({ error: 'غير مصرح' });
      const updated = { ...store, ...payload };
      updated.adminPassword = store.adminPassword || '';
      await writeStore(updated);
      return res.status(200).json({ ok: true });
    }

    if (action === 'admin_change_password') {
      if (password !== activePass) return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
      const newPass = String(payload?.newPassword || '').trim();
      if (newPass.length < 4) return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 4 خانات على الأقل' });
      store.adminPassword = newPass;
      await writeStore(store);
      return res.status(200).json({ ok: true });
    }

    if (action === 'cleanup_blobs') {
      if (password !== activePass) return res.status(401).json({ error: 'غير مصرح' });
      const usedUrls = getUsedImageUrls(store);
      const { blobs } = await list({ prefix: 'sharjah/' });

      const unusedUrls = blobs
        .filter(b => b.pathname !== DATA_FILE && !usedUrls.has(b.url))
        .map(b => b.url);

      if (unusedUrls.length > 0) {
        await del(unusedUrls);
      }
      return res.status(200).json({ ok: true, deletedCount: unusedUrls.length });
    }

    if (action === 'customer_register') {
      const { name, phone, username, password: custPass } = payload;
      if (store.customers.some((c) => c.username === username)) {
        return res.status(400).json({ error: 'اسم المستخدم مستخدم مسبقاً' });
      }
      store.customers.push({ name, phone, username, password: custPass });
      await writeStore(store);
      return res.status(200).json({ ok: true, customer: { name, phone, username } });
    }

    if (action === 'customer_login') {
      const { username, password: custPass } = payload;
      const found = store.customers.find((c) => c.username === username && c.password === custPass);
      if (!found) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      return res.status(200).json({ ok: true, customer: { name: found.name, phone: found.phone, username: found.username } });
    }

    if (action === 'create_order') {
      store.orders.push(payload);
      await writeStore(store);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
