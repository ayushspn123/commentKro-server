const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { getPosts } = require('./meta.controller');

router.use(authenticate);

// GET /api/meta/posts?pageId=&platform=
router.get('/posts', getPosts);

module.exports = router;
