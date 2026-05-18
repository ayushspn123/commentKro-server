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

const automationBody = z.object({
  pageId: z.string().min(1),
  platform: z.enum(['instagram', 'facebook']),
  name: z.string().min(1).max(100),
  trigger: z.object({
    type: z.enum(['comment', 'message', 'story_mention']),
    keywords: z.array(z.string().min(1)).optional().default([]),
    anyKeyword: z.boolean().optional(),
    matchType: z.enum(['any', 'all', 'exact']).optional(),
    caseSensitive: z.boolean().optional(),
  }),
  actions: z.array(actionSchema).min(1),
  mediaFilter: z.enum(['all', 'specific']).optional(),
  postIds: z.array(z.string()).optional(),
  requireFollow: z.boolean().optional(),
  followPromptMessage: z.string().max(500).optional(),
  replyOnDmSent: z.boolean().optional(),
  replyOnDmSentMessage: z.string().max(500).optional(),
});

const createSchema = z.object({ body: automationBody });
const updateSchema = z.object({ body: automationBody.partial() });

router.use(authenticate);

router.get('/',        controller.listAutomations);
router.post('/',       validate(createSchema), controller.createAutomation);
router.get('/:id',     controller.getAutomation);
router.put('/:id',     validate(updateSchema), controller.updateAutomation);
router.patch('/:id/toggle', controller.toggleAutomation);
router.post('/:id/test',    controller.testAutomation);
router.delete('/:id',  controller.deleteAutomation);

module.exports = router;
