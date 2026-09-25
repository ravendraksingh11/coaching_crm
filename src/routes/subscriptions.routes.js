const express = require("express");

const router = express.Router();

const {
    auth,
    superAdminOnly,
    instituteAdminOnly,
} = require("../middleware/auth");

const {
    getAllSubscriptions,
    getMySubscription,
    activateSubscriptionBySuperAdmin,
    purchaseSubscription,
} = require("../controllers/subscriptions.controller");


// ========================================
// SUPER ADMIN
// ========================================

router.get(
    "/",
    auth,
    superAdminOnly,
    getAllSubscriptions
);

router.post(
    "/activate",
    auth,
    superAdminOnly,
    activateSubscriptionBySuperAdmin
);


// ========================================
// INSTITUTE ADMIN
// ========================================

router.get(
    "/my",
    auth,
    instituteAdminOnly,
    getMySubscription
);

router.post(
    "/purchase",
    auth,
    instituteAdminOnly,
    purchaseSubscription
);


module.exports = router;