const Setting = require('../db/models/Setting');

async function getSetting(key, defaultValue = '') {
  const doc = await Setting.findOne({ key });
  if (!doc) return defaultValue;
  return doc.value;
}

async function setSetting(key, value) {
  const doc = await Setting.findOneAndUpdate(
    { key },
    { value },
    { upsert: true, new: true }
  );
  return doc.value;
}

module.exports = {
  getSetting,
  setSetting,
};


