const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const {
  assistUser,
} = require('../services/aiAssistantService');

const askAssistant = catchAsync(async (req, res, next) => {
  const { question, conversationHistory = [] } = req.body;

  if (typeof question !== 'string' || !question.trim()) {
    return next(
      new AppError('A non-empty IT question is required.', 400)
    );
  }

 const result = await assistUser(question, conversationHistory);

  return res.status(200).json({
    assistant: result,
  });
});

module.exports = {
  askAssistant,
};