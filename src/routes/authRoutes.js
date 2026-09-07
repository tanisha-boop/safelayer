const express = require('express');

const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const {
    authenticate
} = require('../middleware/authMiddleware');
const {
    loginSchema
} = require('../validators/authValidation');

const router = express.Router();

router.post(
    '/login',
    validate(loginSchema),
    authController.login
);

router.get(
    '/me',
    authenticate,
    authController.me
);

module.exports = router;