const mongoose = require('mongoose');

const PerformanceReviewSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true },
    employeeId: { type: String, required: true },
    cycle: { type: String, required: true },
    ratings: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PerformanceReview', PerformanceReviewSchema);
