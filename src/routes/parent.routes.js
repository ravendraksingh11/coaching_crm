const express=require("express");
const {auth}=require("../middleware/auth");
const allowRoles=require("../middleware/roles");
const c=require("../controllers/parent.controller");
const router=express.Router();
router.get("/performance",auth,allowRoles("PARENT"),c.getChildrenPerformance);
router.get("/notifications",auth,allowRoles("PARENT"),c.getNotifications);
module.exports=router;
