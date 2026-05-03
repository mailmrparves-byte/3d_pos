// API utility - all requests go through Vite proxy → backend
export const BASE = import.meta.env.VITE_API_URL || '/api';
export const FILE_BASE = BASE.replace('/api', '');

function getToken() {
  return localStorage.getItem('i3d_token');
}

async function request(method, path, data = null) {
  const token = getToken();
  const isFormData = data instanceof FormData;
  const opts = {
    method,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
  if (data) opts.body = isFormData ? data : JSON.stringify(data);
  
  const res = await fetch(`${BASE}${path}`, opts);
  if (res.status === 401) {
    localStorage.removeItem('i3d_token');
    window.location.href = '/login';
    return;
  }
  
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, data) => request('POST', path, data),
  put: (path, data) => request('PUT', path, data),
  delete: (path) => request('DELETE', path),
};

// Currency formatter — Bangladeshi style (1,00,000)
export function fmtCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '৳0';
  const num = parseFloat(amount);
  const abs = Math.abs(num);
  let str;
  if (abs >= 10000000) {
    const crore = Math.floor(abs / 10000000);
    const remainder = abs % 10000000;
    str = crore.toLocaleString('en-IN') + ',' + Math.floor(remainder / 100000).toString().padStart(2, '0') + ',' + Math.floor((remainder % 100000) / 1000).toString().padStart(2, '0') + ',' + (remainder % 1000).toString().padStart(3, '0');
  } else {
    str = abs.toLocaleString('en-IN');
  }
  return (num < 0 ? '-৳' : '৳') + str;
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtNumber(n) {
  if (!n) return '0';
  return parseFloat(n).toLocaleString('en-IN');
}

export function statusBadge(status) {
  const map = {
    paid: 'badge-green', active: 'badge-green', in_stock: 'badge-green', delivered: 'badge-green', received: 'badge-green',
    preorder: 'badge-yellow', partial: 'badge-yellow', low: 'badge-yellow', pending: 'badge-yellow', open: 'badge-yellow', processing: 'badge-yellow',
    overdue: 'badge-red', critical: 'badge-red', out: 'badge-red', failed: 'badge-red', inactive: 'badge-red',
    draft: 'badge-gray', shipped: 'badge-blue', proforma_received: 'badge-blue', ready_to_deliver: 'badge-blue',
  };
  return map[status?.toLowerCase()] || 'badge-gray';
}

export function statusLabel(status) {
  const map = {
    paid: 'Paid', partial: 'Partial', preorder: 'Preorder', draft: 'Draft',
    in_stock: 'In Stock', low: 'Low', critical: 'Critical', out: 'Out of Stock',
    pending: 'Pending', delivered: 'Delivered', overdue: 'Overdue',
    open: 'Open', failed: 'Failed', active: 'Active', inactive: 'Inactive',
    proforma_received: 'Proforma', paid_po: 'Paid', shipped: 'Shipped', received: 'Received',
    ready_to_deliver: 'Ready', processing: 'Processing',
  };
  return map[status?.toLowerCase()] || status || '—';
}
