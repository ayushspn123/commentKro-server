const automationService = require('./automation.service');

const createAutomation = async (req, res, next) => {
  try {
    const automation = await automationService.createAutomation(req.user.id, req.body);
    res.status(201).json({ success: true, data: automation });
  } catch (err) { next(err); }
};

const listAutomations = async (req, res, next) => {
  try {
    const result = await automationService.listAutomations(req.user.id, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const getAutomation = async (req, res, next) => {
  try {
    const Automation = require('./automation.model');
    const automation = await Automation.findOne({ _id: req.params.id, userId: req.user.id });
    if (!automation) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: automation });
  } catch (err) { next(err); }
};

const toggleAutomation = async (req, res, next) => {
  try {
    const automation = await automationService.toggleAutomation(req.user.id, req.params.id, req.body.isActive);
    res.json({ success: true, data: automation });
  } catch (err) { next(err); }
};

const deleteAutomation = async (req, res, next) => {
  try {
    const result = await automationService.deleteAutomation(req.user.id, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const testAutomation = async (req, res, next) => {
  try {
    const result = await automationService.testAutomation(req.user.id, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const updateAutomation = async (req, res, next) => {
  try {
    const automation = await automationService.updateAutomation(req.user.id, req.params.id, req.body);
    res.json({ success: true, data: automation });
  } catch (err) { next(err); }
};

module.exports = { createAutomation, listAutomations, getAutomation, updateAutomation, toggleAutomation, deleteAutomation, testAutomation };
