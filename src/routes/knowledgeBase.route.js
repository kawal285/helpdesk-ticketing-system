const express = require('express');
const {
  loadArticles,
  searchArticles,
  getArticleById,
} = require('../services/knowledgeBaseService');
const {
  saveWebResultToKnowledgeBase,
} = require('../services/knowledgeBaseWriteService');
const { saveWebResultValidator } = require('../validators/knowledgeBase.validators');
const validate = require('../middleware/validate');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(protect);

router.get('/', (req, res, next) => {
  try {
    const articles = loadArticles();

    return res.status(200).json({
      count: articles.length,
      articles,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/search', (req, res, next) => {
  try {
    const query = req.query.q;

    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        message: 'A non-empty search query is required.',
      });
    }

    const articles = searchArticles(query);

    return res.status(200).json({
      query: query.trim(),
      count: articles.length,
      articles,
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/save-web-result',
  authorize('agent', 'admin'),
  saveWebResultValidator,
  validate,
  async (req, res, next) => {
    try {
      const { title, url, snippet, category } = req.body;

      const article = await saveWebResultToKnowledgeBase({
        title,
        url,
        snippet,
        category,
      });

      return res.status(201).json({ article });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return next(error);
    }
  }
);

router.get('/:id', (req, res, next) => {
  try {
    const article = getArticleById(req.params.id);

    if (!article) {
      return res.status(404).json({
        message: 'Knowledge-base article not found.',
      });
    }

    return res.status(200).json({
      article,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;