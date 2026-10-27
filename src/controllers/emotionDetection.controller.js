
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const {
  detectEmotion,
} = require('../services/emotionDetectionService');

const classifyEmotion = catchAsync(async (req, res, next) => {
  const { message } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return next(
      new AppError('A non-empty customer message is required.', 400)
    );
  }

  try {
    const result = await detectEmotion(message);

    return res.status(200).json({
      emotionAnalysis: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return next(new AppError(error.message, error.statusCode));
    }

    return next(error);
  }
});

module.exports = { classifyEmotion };
