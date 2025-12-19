const express = require('express');

const { catchErrors } = require('@/handlers/errorHandlers');
const prisma = require('@/prismaClient');
const mongoose = require('mongoose');
const { getW3upClient } = require('@/services/w3upClient');

const router = express.Router();

const adminController = require('@/controllers/coreControllers/adminController');
const settingController = require('@/controllers/coreControllers/settingController');

const { singleStorageUpload } = require('@/middlewares/uploadMiddleware');

// //_______________________________ Admin management_______________________________

router.route('/admin/read/:id').get(catchErrors(adminController.read));

router.route('/admin/password-update/:id').patch(catchErrors(adminController.updatePassword));

//_______________________________ Admin Profile _______________________________

router.route('/admin/profile/password').patch(catchErrors(adminController.updateProfilePassword));
router
  .route('/admin/profile/update')
  .patch(
    singleStorageUpload({ entity: 'admin', fieldName: 'photo', fileType: 'image' }),
    catchErrors(adminController.updateProfile)
  );

// //____________________________________________ API for Global Setting _________________

router.route('/setting/create').post(catchErrors(settingController.create));
router.route('/setting/read/:id').get(catchErrors(settingController.read));
router.route('/setting/update/:id').patch(catchErrors(settingController.update));
//router.route('/setting/delete/:id).delete(catchErrors(settingController.delete));
router.route('/setting/search').get(catchErrors(settingController.search));
router.route('/setting/list').get(catchErrors(settingController.list));
router.route('/setting/listAll').get(catchErrors(settingController.listAll));
router.route('/setting/filter').get(catchErrors(settingController.filter));
router
  .route('/setting/readBySettingKey/:settingKey')
  .get(catchErrors(settingController.readBySettingKey));
router.route('/setting/listBySettingKey').get(catchErrors(settingController.listBySettingKey));
router
  .route('/setting/updateBySettingKey/:settingKey?')
  .patch(catchErrors(settingController.updateBySettingKey));
router
  .route('/setting/upload/:settingKey?')
  .patch(
    catchErrors(
      singleStorageUpload({ entity: 'setting', fieldName: 'settingValue', fileType: 'image' })
    ),
    catchErrors(settingController.updateBySettingKey)
  );
router.route('/setting/updateManySetting').patch(catchErrors(settingController.updateManySetting));

// _______________________________ AuroraHR / Postgres health check _______________________________
router.route('/health/postgres').get(
  catchErrors(async (req, res) => {
    const companiesCount = await prisma.company.count();
    const usersCount = await prisma.user.count();

    res.json({
      ok: true,
      postgres: true,
      companiesCount,
      usersCount,
    });
  })
);

// _______________________________ MongoDB health check _______________________________
router.route('/health/mongo').get(
  catchErrors(async (req, res) => {
    const conn = mongoose.connection;
    const stateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    const status = stateMap[conn.readyState] || 'unknown';
    let pingOk = false;

    try {
      if (conn.db) {
        await conn.db.admin().ping();
        pingOk = true;
      }
    } catch (e) {
      pingOk = false;
    }

    res.json({
      ok: status === 'connected' && pingOk,
      status,
      pingOk,
    });
  })
);

// _______________________________ AuroraHR / Company setup _______________________________
router.route('/aurora/company').post(
  catchErrors(async (req, res) => {
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Unauthorized',
      });
    }

    const { name, country, treasurySafeAddress, settings } = req.body || {};

    if (!name || !country) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'name and country are required',
      });
    }

    // Create company
    const company = await prisma.company.create({
      data: {
        name,
        country,
        treasurySafeAddress: treasurySafeAddress || null,
        settings: settings || undefined,
      },
    });

    // Create or update user mapped from current admin
    const email = admin.email;

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          role: 'OWNER',
          companyId: company.id,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          companyId: company.id,
        },
      });
    }

    res.status(201).json({
      success: true,
      result: {
        company,
        user,
      },
      message: 'AuroraHR company created successfully',
    });
  })
);

// _______________________________ AuroraHR / Employees _______________________________
router.route('/aurora/employees').post(
  catchErrors(async (req, res) => {
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Unauthorized',
      });
    }

    const prismaUser = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (!prismaUser || !prismaUser.companyId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'AuroraHR user or company not configured',
      });
    }

    const { walletAddress, status, name, metadata } = req.body || {};

    if (!status) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'status is required',
      });
    }

    const employee = await prisma.employee.create({
      data: {
        companyId: prismaUser.companyId,
        walletAddress: walletAddress || null,
        status,
        metadata: {
          ...(metadata || {}),
          name: name || (metadata && metadata.name),
        },
      },
    });

    res.status(201).json({
      success: true,
      result: employee,
      message: 'AuroraHR employee created successfully',
    });
  })
);

router.route('/aurora/employees/list').get(
  catchErrors(async (req, res) => {
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Unauthorized',
      });
    }

    const prismaUser = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (!prismaUser || !prismaUser.companyId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'AuroraHR user or company not configured',
      });
    }

    const employees = await prisma.employee.findMany({
      where: { companyId: prismaUser.companyId },
    });

    res.json({
      success: true,
      result: employees,
      message: 'AuroraHR employees list fetched successfully',
    });
  })
);

// _______________________________ AuroraHR / Onboarding Checklists (Mongo) _______________________________
router.route('/aurora/onboarding').post(
  catchErrors(async (req, res) => {
    const admin = req.admin;
    const OnboardingChecklist = mongoose.model('OnboardingChecklist');

    if (!admin) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Unauthorized',
      });
    }

    const prismaUser = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (!prismaUser || !prismaUser.companyId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'AuroraHR user or company not configured',
      });
    }

    const { employeeId, tasks } = req.body || {};

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'employeeId is required',
      });
    }

    let checklist = await OnboardingChecklist.findOne({
      companyId: prismaUser.companyId,
      employeeId,
    }).lean();

    if (!checklist) {
      checklist = await OnboardingChecklist.create({
        companyId: prismaUser.companyId,
        employeeId,
        tasks: Array.isArray(tasks)
          ? tasks.map((t) => ({
              name: t.name,
              completed: !!t.completed,
            }))
          : [],
      });
    }

    res.status(201).json({
      success: true,
      result: checklist,
      message: 'Onboarding checklist created or fetched',
    });
  })
);

router.route('/aurora/onboarding/:employeeId').get(
  catchErrors(async (req, res) => {
    const admin = req.admin;
    const OnboardingChecklist = mongoose.model('OnboardingChecklist');

    if (!admin) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Unauthorized',
      });
    }

    const prismaUser = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (!prismaUser || !prismaUser.companyId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'AuroraHR user or company not configured',
      });
    }

    const { employeeId } = req.params;

    const checklist = await OnboardingChecklist.findOne({
      companyId: prismaUser.companyId,
      employeeId,
    }).lean();

    res.json({
      success: true,
      result: checklist || null,
      message: 'Onboarding checklist fetched',
    });
  })
);

router.route('/aurora/onboarding/:id/tasks').post(
  catchErrors(async (req, res) => {
    const admin = req.admin;
    const OnboardingChecklist = mongoose.model('OnboardingChecklist');

    if (!admin) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Unauthorized',
      });
    }

    const { name } = req.body || {};
    if (!name) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'task name is required',
      });
    }

    const checklist = await OnboardingChecklist.findById(req.params.id);
    if (!checklist) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'Checklist not found',
      });
    }

    checklist.tasks.push({ name, completed: false });
    await checklist.save();

    res.json({
      success: true,
      result: checklist,
      message: 'Task added',
    });
  })
);

router.route('/aurora/onboarding/:id/tasks/:taskId').patch(
  catchErrors(async (req, res) => {
    const admin = req.admin;
    const OnboardingChecklist = mongoose.model('OnboardingChecklist');

    if (!admin) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Unauthorized',
      });
    }

    const checklist = await OnboardingChecklist.findById(req.params.id);
    if (!checklist) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'Checklist not found',
      });
    }

    const task = checklist.tasks.id(req.params.taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'Task not found',
      });
    }

    const { completed } = req.body || {};
    task.completed = !!completed;
    await checklist.save();

    res.json({
      success: true,
      result: checklist,
      message: 'Task updated',
    });
  })
);

// _______________________________ AuroraHR / HR Documents (Mongo) _______________________________
router.route('/aurora/documents').post(
  catchErrors(async (req, res) => {
    const admin = req.admin;
    const HrDocument = mongoose.model('HrDocument');

    if (!admin) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Unauthorized',
      });
    }

    const prismaUser = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (!prismaUser || !prismaUser.companyId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'AuroraHR user or company not configured',
      });
    }

    const { employeeId, type, ipfs_hash, signed_at } = req.body || {};
    if (!employeeId || !type) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'employeeId and type are required',
      });
    }

    const doc = await HrDocument.create({
      companyId: prismaUser.companyId,
      employeeId,
      type,
      ipfs_hash: ipfs_hash || null,
      signed_at: signed_at || null,
    });

    res.status(201).json({
      success: true,
      result: doc,
      message: 'HR document saved',
    });
  })
);

router.route('/aurora/documents/upload').post(
  catchErrors(async (req, res) => {
    const admin = req.admin;
    const HrDocument = mongoose.model('HrDocument');

    if (!admin) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Unauthorized',
      });
    }

    const prismaUser = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (!prismaUser || !prismaUser.companyId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'AuroraHR user or company not configured',
      });
    }

    const { employeeId, type } = req.body || {};
    const file = req.files && req.files.file;

    if (!employeeId || !type || !file) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'employeeId, type and file are required',
      });
    }

    // Use Storacha w3up client (@storacha/client) via internal service
    const client = await getW3upClient();

    // Node 18+ provides File/Blob globals; wrap the uploaded buffer
    const fileBlob = new File([file.data], file.name, { type: file.mimetype });

    let cid;
    try {
      cid = await client.uploadFile(fileBlob);
    } catch (err) {
      return res.status(500).json({
        success: false,
        result: null,
        message: 'Failed to upload document to IPFS (w3up)',
        error: err.message,
      });
    }

    const doc = await HrDocument.create({
      companyId: prismaUser.companyId,
      employeeId,
      type,
      ipfs_hash: cid.toString(),
      signed_at: null,
    });

    res.status(201).json({
      success: true,
      result: doc,
      message: 'HR document uploaded to IPFS (w3up) and saved',
    });
  })
);

router.route('/aurora/documents/:employeeId').get(
  catchErrors(async (req, res) => {
    const admin = req.admin;
    const HrDocument = mongoose.model('HrDocument');

    if (!admin) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Unauthorized',
      });
    }

    const prismaUser = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (!prismaUser || !prismaUser.companyId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'AuroraHR user or company not configured',
      });
    }

    const docs = await HrDocument.find({
      companyId: prismaUser.companyId,
      employeeId: req.params.employeeId,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      result: docs,
      message: 'HR documents fetched',
    });
  })
);

// _______________________________ AuroraHR / Performance Reviews (Mongo) _______________________________
router.route('/aurora/reviews').post(
  catchErrors(async (req, res) => {
    const admin = req.admin;
    const PerformanceReview = mongoose.model('PerformanceReview');

    if (!admin) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Unauthorized',
      });
    }

    const prismaUser = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (!prismaUser || !prismaUser.companyId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'AuroraHR user or company not configured',
      });
    }

    const { employeeId, cycle, ratings } = req.body || {};
    if (!employeeId || !cycle) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'employeeId and cycle are required',
      });
    }

    const review = await PerformanceReview.create({
      companyId: prismaUser.companyId,
      employeeId,
      cycle,
      ratings: ratings || {},
    });

    res.status(201).json({
      success: true,
      result: review,
      message: 'Performance review saved',
    });
  })
);

router.route('/aurora/reviews/:employeeId').get(
  catchErrors(async (req, res) => {
    const admin = req.admin;
    const PerformanceReview = mongoose.model('PerformanceReview');

    if (!admin) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Unauthorized',
      });
    }

    const prismaUser = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (!prismaUser || !prismaUser.companyId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'AuroraHR user or company not configured',
      });
    }

    const reviews = await PerformanceReview.find({
      companyId: prismaUser.companyId,
      employeeId: req.params.employeeId,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      result: reviews,
      message: 'Performance reviews fetched',
    });
  })
);

module.exports = router;
