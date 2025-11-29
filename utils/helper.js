function isAdmin(userId) {
  const adminEnv = process.env.ADMIN_IDS || '';
  const adminIds = adminEnv
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return adminIds.includes(String(userId));
}

function formatCurrency(amount) {
  return `₹${(amount || 0).toFixed(2)}`;
}

function safeJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

module.exports = {
  isAdmin,
  formatCurrency,
  safeJson,
};


