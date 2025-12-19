const mongoose = require('mongoose');

const OnboardingChecklistSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
    },
    employeeId: {
      type: String,
      required: true,
    },
    tasks: [
      {
        name: { type: String, required: true },
        completed: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('OnboardingChecklist', OnboardingChecklistSchema);
