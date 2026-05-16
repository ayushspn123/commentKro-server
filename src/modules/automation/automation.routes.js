const express = require('express');
const router = express.Router();
const { z } = require('zod');
const controller = require('./automation.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');

const actionSchema = z.object({
  type: z.enum(['send_dm', 'reply_comment', 'add_label']),
  template: z.string().min(1).max(2000),
  delay: z.number().min(0).optional(),
  variables: z.record(z.string()).optional(),
});

const createSchema = z.object({
  body: z.object({
    pageId: z.string().min(1),
    platform: z.enum(['instagram', 'facebook']),
    name: z.string().min(1).max(100),
    trigger: z.object({
      type: z.enum(['comment', 'message', 'story_mention']),
      keywords: z.array(z.string().min(1)).min(1),
      matchType: z.enum(['any', 'all', 'exact']).optional(),
      caseSensitive: z.boolean().optional(),
    }),
    actions: z.array(actionSchema).min(1),
    // Post-level targeting (optional)
    mediaFilter: z.enum(['all', 'specific']).optional(),
    postIds: z.array(z.string()).optional(),
  }),
});

router.use(authenticate);

router.get('/',        controller.listAutomations);
router.post('/',       validate(createSchema), controller.createAutomation);
router.get('/:id',     controller.getAutomation);
router.patch('/:id/toggle', controller.toggleAutomation);
router.post('/:id/test',    controller.testAutomation);
router.delete('/:id',  controller.deleteAutomation);

module.exports = router;
