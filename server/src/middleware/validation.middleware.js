const { body } = require('express-validator');

/**
 * Validation rules cho đăng ký
 */
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters')
    .isAlphanumeric()
    .withMessage('Username must contain only letters and numbers'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('displayName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Display name must be 2-50 characters'),
  body('phone')
    .optional()
    .trim()
    .isMobilePhone('vi-VN')
    .withMessage('Invalid Vietnamese phone number'),
];

/**
 * Validation rules cho đăng nhập
 */
const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

/**
 * Validation rules cho tạo session
 */
const createSessionValidation = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be 3-100 characters'),
  body('playDate')
    .isISO8601()
    .withMessage('Invalid date format'),
  body('startTime')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Start time must be in HH:mm format'),
  body('endTime')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('End time must be in HH:mm format'),
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Location is required'),
  body('minPlayers')
    .isInt({ min: 2, max: 30 })
    .withMessage('Min players must be between 2 and 30'),
  body('maxPlayers')
    .isInt({ min: 2, max: 30 })
    .withMessage('Max players must be between 2 and 30'),
  body('voteDeadline')
    .optional()
    .isISO8601()
    .withMessage('Invalid deadline format'),
];

module.exports = {
  registerValidation,
  loginValidation,
  createSessionValidation,
};
