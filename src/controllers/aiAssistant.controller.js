const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const {
  assistUser,
} = require('../services/aiAssistantService');

const MAX_HISTORY_ITEMS = 2;
const MAX_HISTORY_LENGTH = 300;

// The browser sends the user's last couple of questions so a short follow-up
// can be understood. Anything that is not a plain string is dropped, and
// each item is capped, because this comes straight from the request body.
function cleanHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, MAX_HISTORY_LENGTH))
    .filter(Boolean)
    .slice(-MAX_HISTORY_ITEMS);
}

const askAssistant = catchAsync(async (req, res, next) => {
  const { question } = req.body;

  if (typeof question !== 'string' || !question.trim()) {
    return next(
      new AppError('A non-empty IT question is required.', 400)
    );
  }

  const result = await assistUser(question, {
    history: cleanHistory(req.body.history),
    // Strictly the boolean true -- a string or number from the request body
    // must not be able to switch agents.
    thinkDeeper: req.body.thinkDeeper === true,
  });

  return res.status(200).json({
    assistant: result,
  });
});

module.exports = {
  askAssistant,
};