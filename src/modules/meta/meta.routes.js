const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { getPosts, disconnectPage } = require('./meta.controller');

router.use(authenticate);

// GET /api/meta/posts?pageId=&platform=
router.get('/posts', getPosts);

// DELETE /api/meta/disconnect — remove a connected page
router.delete('/disconnect', disconnectPage);

module.exports = router;
