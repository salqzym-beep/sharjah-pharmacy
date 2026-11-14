import { put, list } from '@vercel/blob';

const DATA_FILE = 'sharjah/store-data.json';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'cc7895236';

const defaultData = {
  products: [],
  categories: ['أدوية', 'العناية بطفل', 'العناية بالأم', 'أدوات تجميل'],
  categoryArt: {},
  banners: [],
  settings: {
    brand: 'صيدلية الشارقة',
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
  // جلب أحدث نسخة مع تجاوز الكاش
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    // 1. جلب البيانات للمتجر ولوحة التحكم
    if (req.method === 'GET') {
      const store = await readStore();
      // إخفاء كلمات مرور العملاء عن الواجهة العامة
      const safeCustomers = store.customers.map(({ password, ...rest }) => rest);
      return res.status(200).json({ ...store, customers: safeCustomers });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { action, password, payload } = body;
    const store = await readStore();

    // التحقق من دخول الأدمن
    if (action === 'admin_login') {
      if (password !== ADMIN_PASS) return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
      return res.status(200).json({ ok: true, store });
    }

    // تحديث بيانات المتجر من لوحة التحكم (يتطلب كلمة مرور الأدمن)
    if (action === 'admin_save') {
      if (password !== ADMIN_PASS) return res.status(401).json({ error: 'غير مصرح' });
      const updated = { ...store, ...payload };
      await writeStore(updated);
      return res.status(200).json({ ok: true });
    }

    // تسجيل حساب عميل جديد
    if (action === 'customer_register') {
      const { name, phone, username, password: custPass } = payload;
      if (store.customers.some((c) => c.username === username)) {
        return res.status(400).json({ error: 'اسم المستخدم مستخدم مسبقاً' });
      }
      store.customers.push({ name, phone, username, password: custPass });
      await writeStore(store);
      return res.status(200).json({ ok: true, customer: { name, phone, username } });
    }

    // تسجيل دخول عميل
    if (action === 'customer_login') {
      const { username, password: custPass } = payload;
      const found = store.customers.find((c) => c.username === username && c.password === custPass);
      if (!found) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      return res.status(200).json({ ok: true, customer: { name: found.name, phone: found.phone, username: found.username } });
    }

    // إرسال طلب جديد من العميل
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
