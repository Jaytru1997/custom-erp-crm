const mongoose = require('mongoose');

const HrDocumentSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true },
    employeeId: { type: String, required: true },
    type: { type: String, required: true },
    ipfs_hash: { type: String, default: null },
    signed_at: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HrDocument', HrDocumentSchema);
